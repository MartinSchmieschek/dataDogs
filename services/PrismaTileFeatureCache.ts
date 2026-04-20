/**
 * ~~~ THE PRISMA TILE FEATURE CACHE ~~~
 *
 * Atomarer Geo-Feature-Store auf Slippy-Map-Tiles (Multi-Zoom).
 *
 * Drei Modelle in cache.db:
 *  - GeoFeature: 1 Zeile pro (dogType, osmType, osmId) mit voller Geometrie + Payload.
 *  - FeatureTileMembership: Mapping-Tabelle (feature × zoom × tile × facet).
 *  - TileCoverage: (dogType, zoom, tile, facet, expiresAt) — "wir haben hier gefetcht".
 *
 * Ablauf pro Query:
 *  1. getCoveredFeatures(dogType, tiles, facets) laedt aktive Coverages +
 *     alle Features, deren Membership auf eine der angefragten Kombinationen passt.
 *     Der Dog bekommt {features, missing[]} zurueck.
 *  2. Dog fetcht die missing (tile, facet) per Overpass und ruft
 *     storeFetchResult(...) auf. Features werden per OSM-ID dedupliziert;
 *     Membership wird in *alle* Tiles gesetzt, die die Feature-BBox schneiden
 *     (groesseres Polygon → mehrere Tiles).
 *  3. prune() loescht expired Coverages, danach verwaiste Memberships und
 *     zuletzt Features ohne verbleibende Membership.
 *
 * In-flight dedup pro (dogType, zoom, tile, facet) wird NICHT hier gemacht —
 * dafuer ist das auf der Ebene der Overpass-Factory (PrismaCacheHandler.getOrFetch)
 * zustaendig, mit eigenem Key pro Tile+Facet.
 */

import type { PrismaClient } from '../store/generated/prisma-cache-client';
import {
    isRuntimeLogVerbose,
    tilesIntersectingBBox,
    tileKeyString,
    type ITileFeatureCache,
    type StoredGeoFeature,
    type TileCoverageResult,
    type TileFetchResult,
    type TileKey,
} from '@datadogs/core';

interface CoverageRow {
    dogType: string;
    zoom: number;
    tileX: number;
    tileY: number;
    facet: string;
    fetchedAt: bigint;
    expiresAt: bigint;
}

interface FeatureRow {
    dogType: string;
    osmType: string;
    osmId: bigint;
    primaryKey: string | null;
    primaryValue: string | null;
    name: string | null;
    hasGeom: boolean;
    lat: number | null;
    lng: number | null;
    bboxMinLat: number | null;
    bboxMinLng: number | null;
    bboxMaxLat: number | null;
    bboxMaxLng: number | null;
    payload: string;
    updatedAt: bigint;
}

export class PrismaTileFeatureCache implements ITileFeatureCache {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    async getCoveredFeatures(
        dogType: string,
        tiles: TileKey[],
        facets: string[],
    ): Promise<TileCoverageResult> {
        if (tiles.length === 0 || facets.length === 0) {
            return { features: [], missing: [] };
        }

        const now = BigInt(Date.now());

        // Alle Coverages fuer (dogType, zoom, tile, facet) in einem Schwung.
        // Wir filtern auf zoom-Gruppe(n) — typisch ist pro Query genau ein Zoom,
        // aber der Interface-Vertrag erlaubt theoretisch Mehrzoom.
        const zoomBuckets = new Map<number, TileKey[]>();
        for (const t of tiles) {
            const bucket = zoomBuckets.get(t.zoom) ?? [];
            bucket.push(t);
            zoomBuckets.set(t.zoom, bucket);
        }

        const activeCoverageKeys = new Set<string>(); // "zoom/x/y/facet"
        for (const [zoom, tilesInZoom] of zoomBuckets) {
            const rows = (await this.prisma.tileCoverage.findMany({
                where: {
                    dogType,
                    zoom,
                    facet: { in: facets },
                    expiresAt: { gt: now },
                    OR: tilesInZoom.map((t) => ({ tileX: t.x, tileY: t.y })),
                },
            })) as CoverageRow[];
            for (const r of rows) {
                activeCoverageKeys.add(`${r.zoom}/${r.tileX}/${r.tileY}/${r.facet}`);
            }
        }

        // Fehlende Kombinationen ermitteln.
        const missing: Array<{ tile: TileKey; facet: string }> = [];
        for (const t of tiles) {
            for (const f of facets) {
                if (!activeCoverageKeys.has(`${t.zoom}/${t.x}/${t.y}/${f}`)) {
                    missing.push({ tile: t, facet: f });
                }
            }
        }

        // Features fuer aktive Coverages holen: ein raw-SQL-JOIN statt
        // zweier findMany-Calls mit tausenden OR-Conditions (die Prisma
        // auf SQLite teilweise mit leerem Resultat beantwortet).
        const features: StoredGeoFeature[] = [];
        if (activeCoverageKeys.size > 0) {
            const coverageConditions: Array<{
                zoom: number;
                tileX: number;
                tileY: number;
                facet: string;
            }> = [];
            for (const key of activeCoverageKeys) {
                const [z, x, y, ...facetRest] = key.split('/');
                coverageConditions.push({
                    zoom: Number(z),
                    tileX: Number(x),
                    tileY: Number(y),
                    facet: facetRest.join('/'),
                });
            }

            const tupleClause = coverageConditions
                .map(() => '(m."zoom"=? AND m."tileX"=? AND m."tileY"=? AND m."facet"=?)')
                .join(' OR ');
            const params: Array<string | number> = [dogType];
            for (const c of coverageConditions) {
                params.push(c.zoom, c.tileX, c.tileY, c.facet);
            }

            const rows = (await this.prisma.$queryRawUnsafe(
                `SELECT DISTINCT f.*
                 FROM "GeoFeature" f
                 INNER JOIN "FeatureTileMembership" m
                   ON m."dogType"=f."dogType"
                      AND m."osmType"=f."osmType"
                      AND m."osmId"=f."osmId"
                 WHERE f."dogType"=?
                   AND (${tupleClause})`,
                ...params,
            )) as FeatureRow[];

            for (const r of rows) {
                features.push(this.rowToStored(r));
            }
        }

        if (isRuntimeLogVerbose()) {
            console.log(
                `[TileFeatureCache] getCovered dogType=${dogType} tiles=${tiles.length} facets=${facets.length} → ${features.length} features, ${missing.length} missing`,
            );
        }

        return { features, missing };
    }

    async storeFetchResult(
        dogType: string,
        result: TileFetchResult,
        ttlMs: number,
    ): Promise<void> {
        const now = BigInt(Date.now());
        const expiresAt = BigInt(Date.now() + ttlMs);
        const fetchTile = result.tile;

        // Membership-Rows pro Feature berechnen (Feature-BBox x Facets → Tiles).
        interface MemRow {
            osmType: string;
            osmId: bigint;
            zoom: number;
            tileX: number;
            tileY: number;
            facet: string;
        }
        const memberships: MemRow[] = [];
        for (const f of result.features) {
            const osmId = BigInt(f.osmId);
            const membershipTiles: TileKey[] = [];
            if (
                f.hasGeom &&
                f.bboxMinLat != null &&
                f.bboxMinLng != null &&
                f.bboxMaxLat != null &&
                f.bboxMaxLng != null
            ) {
                membershipTiles.push(
                    ...tilesIntersectingBBox(
                        {
                            minLat: f.bboxMinLat,
                            minLng: f.bboxMinLng,
                            maxLat: f.bboxMaxLat,
                            maxLng: f.bboxMaxLng,
                        },
                        fetchTile.zoom,
                    ),
                );
            } else {
                membershipTiles.push(fetchTile);
            }
            for (const facet of f.facets) {
                for (const tile of membershipTiles) {
                    memberships.push({
                        osmType: f.osmType,
                        osmId,
                        zoom: tile.zoom,
                        tileX: tile.x,
                        tileY: tile.y,
                        facet,
                    });
                }
            }
        }

        // Bulk-Upsert per raw SQL: SQLite `INSERT OR REPLACE` ist die schnelle
        // Variante (statt N×upsert-Roundtrips). Wir chunken, damit die
        // SQL-Parameter-Liste handhabbar bleibt (SQLite-Max ~999 params).
        const FEATURE_COLS = 14;
        const FEATURE_CHUNK = Math.floor(900 / FEATURE_COLS);
        const MEM_COLS = 7;
        const MEM_CHUNK = Math.floor(900 / MEM_COLS);

        // Alles innerhalb einer Transaktion → atomar und ohne parallele Write-Lock-Konflikte.
        // Timeout generous setzen: bei vielen Tiles parallel serialisiert SQLite die Writes,
        // die wartenden Transaktionen muessen laenger ueberleben duerfen als der Default (5s).
        await this.prisma.$transaction(async (tx) => {
            // 1. Features (INSERT OR REPLACE)
            for (let i = 0; i < result.features.length; i += FEATURE_CHUNK) {
                const chunk = result.features.slice(i, i + FEATURE_CHUNK);
                if (chunk.length === 0) continue;
                const placeholders = chunk.map(() =>
                    '(?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
                ).join(',');
                const values: any[] = [];
                for (const f of chunk) {
                    values.push(
                        dogType,
                        f.osmType,
                        BigInt(f.osmId),
                        f.primaryKey,
                        f.primaryValue,
                        f.name,
                        f.hasGeom ? 1 : 0,
                        f.lat,
                        f.lng,
                        f.bboxMinLat,
                        f.bboxMinLng,
                        f.bboxMaxLat,
                        f.bboxMaxLng,
                        f.payload,
                    );
                }
                await tx.$executeRawUnsafe(
                    `INSERT OR REPLACE INTO "GeoFeature"
                     ("dogType","osmType","osmId","primaryKey","primaryValue","name","hasGeom","lat","lng","bboxMinLat","bboxMinLng","bboxMaxLat","bboxMaxLng","payload","updatedAt")
                     VALUES ${chunk.map(() =>
                         '(?,?,?,?,?,?,?,?,?,?,?,?,?,?,' + now.toString() + ')'
                     ).join(',')}`,
                    ...values,
                );
            }

            // 2. Memberships (INSERT OR IGNORE — PK-Kollision = bereits drin, nichts zu tun)
            for (let i = 0; i < memberships.length; i += MEM_CHUNK) {
                const chunk = memberships.slice(i, i + MEM_CHUNK);
                if (chunk.length === 0) continue;
                const values: any[] = [];
                for (const m of chunk) {
                    values.push(
                        dogType,
                        m.osmType,
                        m.osmId,
                        m.zoom,
                        m.tileX,
                        m.tileY,
                        m.facet,
                    );
                }
                await tx.$executeRawUnsafe(
                    `INSERT OR IGNORE INTO "FeatureTileMembership"
                     ("dogType","osmType","osmId","zoom","tileX","tileY","facet")
                     VALUES ${chunk.map(() => '(?,?,?,?,?,?,?)').join(',')}`,
                    ...values,
                );
            }

            // 3. Coverage fuer jede Facet dieses Fetches (auch bei 0 Features —
            //    Negative-Cache fuer die Tile).
            if (result.facets.length > 0) {
                const covValues: any[] = [];
                for (const facet of result.facets) {
                    covValues.push(
                        dogType,
                        fetchTile.zoom,
                        fetchTile.x,
                        fetchTile.y,
                        facet,
                    );
                }
                await tx.$executeRawUnsafe(
                    `INSERT OR REPLACE INTO "TileCoverage"
                     ("dogType","zoom","tileX","tileY","facet","fetchedAt","expiresAt")
                     VALUES ${result.facets.map(() =>
                         `(?,?,?,?,?,${now.toString()},${expiresAt.toString()})`
                     ).join(',')}`,
                    ...covValues,
                );
            }
        }, {
            // SQLite serialisiert Writes — bei mehreren parallelen Tile-Fetches
            // kann eine Transaktion warten. 60s Timeout deckt auch grosse Batches.
            maxWait: 60_000,
            timeout: 60_000,
        });

        if (isRuntimeLogVerbose()) {
            console.log(
                `[TileFeatureCache] stored dogType=${dogType} tile=${tileKeyString(fetchTile)} facets=[${result.facets.join(',')}] features=${result.features.length}`,
            );
        }
    }

    async invalidateDogType(dogType: string): Promise<void> {
        await this.prisma.tileCoverage.deleteMany({ where: { dogType } });
        await this.prisma.featureTileMembership.deleteMany({ where: { dogType } });
        await this.prisma.geoFeature.deleteMany({ where: { dogType } });
    }

    /**
     * Prune-Pipeline:
     *  a) Expired Coverages loeschen.
     *  b) Memberships, deren (dogType, zoom, tile, facet) keine aktive Coverage
     *     mehr hat, loeschen.
     *  c) Features ohne verbleibende Membership loeschen (Orphan-GC).
     */
    async prune(): Promise<{ coverages: number; memberships: number; features: number }> {
        const now = BigInt(Date.now());

        const expired = (await this.prisma.tileCoverage.findMany({
            where: { expiresAt: { lte: now } },
            select: {
                dogType: true,
                zoom: true,
                tileX: true,
                tileY: true,
                facet: true,
            },
        })) as Array<{
            dogType: string;
            zoom: number;
            tileX: number;
            tileY: number;
            facet: string;
        }>;

        let removedCoverages = 0;
        let removedMemberships = 0;
        if (expired.length > 0) {
            const covDelete = await this.prisma.tileCoverage.deleteMany({
                where: { expiresAt: { lte: now } },
            });
            removedCoverages = covDelete.count;

            // Memberships die auf die geloeschten Coverages matchen.
            // Chunked delete um IN-Listen handhabbar zu halten.
            const chunkSize = 50;
            for (let i = 0; i < expired.length; i += chunkSize) {
                const chunk = expired.slice(i, i + chunkSize);
                const memDelete = await this.prisma.featureTileMembership.deleteMany({
                    where: {
                        OR: chunk.map((e) => ({
                            dogType: e.dogType,
                            zoom: e.zoom,
                            tileX: e.tileX,
                            tileY: e.tileY,
                            facet: e.facet,
                        })),
                    },
                });
                removedMemberships += memDelete.count;
            }
        }

        // Orphan-Features: dogType + (osmType, osmId) ohne Membership-Eintrag.
        // Wir holen alle (dogType, osmType, osmId) aus Memberships, dann Delta zu Features.
        const memberSet = new Set<string>();
        const memberRefs = (await this.prisma.featureTileMembership.findMany({
            select: { dogType: true, osmType: true, osmId: true },
            distinct: ['dogType', 'osmType', 'osmId'],
        })) as Array<{ dogType: string; osmType: string; osmId: bigint }>;
        for (const m of memberRefs) {
            memberSet.add(`${m.dogType}:${m.osmType}:${m.osmId.toString()}`);
        }

        const allFeatures = (await this.prisma.geoFeature.findMany({
            select: { dogType: true, osmType: true, osmId: true },
        })) as Array<{ dogType: string; osmType: string; osmId: bigint }>;

        const orphans = allFeatures.filter(
            (f) => !memberSet.has(`${f.dogType}:${f.osmType}:${f.osmId.toString()}`),
        );

        let removedFeatures = 0;
        if (orphans.length > 0) {
            const chunkSize = 50;
            for (let i = 0; i < orphans.length; i += chunkSize) {
                const chunk = orphans.slice(i, i + chunkSize);
                const del = await this.prisma.geoFeature.deleteMany({
                    where: {
                        OR: chunk.map((o) => ({
                            dogType: o.dogType,
                            osmType: o.osmType,
                            osmId: o.osmId,
                        })),
                    },
                });
                removedFeatures += del.count;
            }
        }

        if (isRuntimeLogVerbose() && (removedCoverages + removedMemberships + removedFeatures) > 0) {
            console.log(
                `[TileFeatureCache] pruned coverages=${removedCoverages} memberships=${removedMemberships} features=${removedFeatures}`,
            );
        }

        return {
            coverages: removedCoverages,
            memberships: removedMemberships,
            features: removedFeatures,
        };
    }

    private rowToStored(r: FeatureRow): StoredGeoFeature {
        return {
            dogType: r.dogType,
            osmType: r.osmType,
            osmId: r.osmId.toString(),
            primaryKey: r.primaryKey,
            primaryValue: r.primaryValue,
            name: r.name,
            hasGeom: r.hasGeom,
            lat: r.lat,
            lng: r.lng,
            bboxMinLat: r.bboxMinLat,
            bboxMinLng: r.bboxMinLng,
            bboxMaxLat: r.bboxMaxLat,
            bboxMaxLng: r.bboxMaxLng,
            payload: r.payload,
            updatedAt: Number(r.updatedAt),
        };
    }
}
