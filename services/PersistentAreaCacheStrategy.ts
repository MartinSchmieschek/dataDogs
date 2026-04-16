/**
 * ~~~ THE PERSISTENT AREA CACHE STRATEGY ~~~
 *
 * Schreibt Geo-Areas in die cache.db (Prisma). Ueberlebt Prozess-Restarts,
 * liefert Containment-Checks per Circle oder BBox.
 *
 * Jede Partition = ein Discriminant (z.B. "drinking-water", "food:cuisine=italian").
 * Pro Partition halten wir einen kleinen In-Memory-Hot-Cache, den wir bei erstem
 * Zugriff aus der DB laden. Writes gehen synchron in DB und Hot-Cache.
 * Der Hot-Cache ist pro Instanz geteilt und wird ueber die gesamte Laufzeit
 * ueber alle Dogs hinweg wiederverwendet, da KennelRun denselben AreaCache
 * in jeden Dog injiziert.
 *
 * BBox-Vorfilter: jede Row traegt ihre vorberechnete BBox, das SQL-WHERE
 * schraenkt die Kandidaten grob ein bevor wir haversine rechnen.
 */

import type { PrismaClient } from '../store/generated/prisma-cache-client';
import {
    IAreaCache,
    CachedArea,
    GeoBBox,
    isRuntimeLogVerbose,
} from '@datadogs/core';

function haversineDistance(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number }
): number {
    const R = 6_371_000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h =
        sinDLat * sinDLat +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
    return 2 * R * Math.asin(Math.sqrt(h));
}

/** Berechnet eine konservative BBox, die einen (center, radius)-Circle komplett enthaelt. */
function circleToBBox(
    centerLat: number,
    centerLng: number,
    radiusM: number
): GeoBBox {
    const metrePerDegLat = 111_320;
    const dLat = radiusM / metrePerDegLat;
    const cosLat = Math.max(Math.cos((centerLat * Math.PI) / 180), 1e-6);
    const dLng = radiusM / (metrePerDegLat * cosLat);
    return {
        minLat: centerLat - dLat,
        maxLat: centerLat + dLat,
        minLng: centerLng - dLng,
        maxLng: centerLng + dLng,
    };
}

interface StoredRow {
    id: string;
    discriminant: string;
    centerLat: number;
    centerLng: number;
    radiusM: number;
    bboxMinLat: number;
    bboxMinLng: number;
    bboxMaxLat: number;
    bboxMaxLng: number;
    cacheKey: string;
    payload: string;
    cachedAt: bigint;
    expiresAt: bigint;
}

export class PersistentAreaCacheStrategy<T> implements IAreaCache<T> {
    private prisma: PrismaClient;
    /** Hot-Cache pro Discriminant; wird lazy aus der DB gefuellt */
    private partitions = new Map<string, CachedArea<T>[]>();
    private loadedPartitions = new Set<string>();

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    private async loadPartition(discriminant: string): Promise<CachedArea<T>[]> {
        const cached = this.partitions.get(discriminant);
        if (cached && this.loadedPartitions.has(discriminant)) return cached;

        const now = BigInt(Date.now());
        const rows = (await this.prisma.geoAreaCache.findMany({
            where: {
                discriminant,
                expiresAt: { gt: now },
            },
        })) as StoredRow[];

        const areas: CachedArea<T>[] = rows.map((r) => ({
            center: { lat: r.centerLat, lng: r.centerLng },
            radiusM: r.radiusM,
            data: JSON.parse(r.payload) as T,
            cacheKey: r.cacheKey,
            cachedAt: Number(r.cachedAt),
            discriminant: r.discriminant,
        }));

        this.partitions.set(discriminant, areas);
        this.loadedPartitions.add(discriminant);
        if (isRuntimeLogVerbose()) {
            console.log(
                `[PersistentAreaCache] loaded partition '${discriminant}' (${areas.length} areas)`
            );
        }
        return areas;
    }

    async findCovering(
        center: { lat: number; lng: number },
        radiusM: number,
        discriminant: string
    ): Promise<CachedArea<T> | undefined> {
        const areas = await this.loadPartition(discriminant);
        for (const area of areas) {
            const dist = haversineDistance(center, area.center);
            if (dist + radiusM <= area.radiusM) {
                if (isRuntimeLogVerbose()) {
                    console.log(
                        `[PersistentAreaCache] HIT circle '${discriminant}' (${center.lat},${center.lng} r=${radiusM}m) in (${area.center.lat},${area.center.lng} r=${area.radiusM}m)`
                    );
                }
                return area;
            }
        }
        return undefined;
    }

    async findCoveringBBox(
        bbox: GeoBBox,
        discriminant: string
    ): Promise<CachedArea<T> | undefined> {
        const areas = await this.loadPartition(discriminant);
        for (const area of areas) {
            // Circle, der die Query-BBox vollstaendig enthaelt:
            // alle 4 Ecken muessen innerhalb des Circles liegen.
            const corners: { lat: number; lng: number }[] = [
                { lat: bbox.minLat, lng: bbox.minLng },
                { lat: bbox.minLat, lng: bbox.maxLng },
                { lat: bbox.maxLat, lng: bbox.minLng },
                { lat: bbox.maxLat, lng: bbox.maxLng },
            ];
            const allInside = corners.every(
                (c) => haversineDistance(c, area.center) <= area.radiusM
            );
            if (allInside) {
                if (isRuntimeLogVerbose()) {
                    console.log(
                        `[PersistentAreaCache] HIT bbox '${discriminant}' covered by (${area.center.lat},${area.center.lng} r=${area.radiusM}m)`
                    );
                }
                return area;
            }
        }
        return undefined;
    }

    async store(area: CachedArea<T>, ttlMs: number): Promise<void> {
        const areas = await this.loadPartition(area.discriminant);

        // Schon von bestehender area abgedeckt? Dann speichern wir nicht.
        for (const existing of areas) {
            const dist = haversineDistance(area.center, existing.center);
            if (dist + area.radiusM <= existing.radiusM) {
                if (isRuntimeLogVerbose()) {
                    console.log(
                        `[PersistentAreaCache] SKIP: new area already covered by existing (${existing.center.lat},${existing.center.lng} r=${existing.radiusM}m)`
                    );
                }
                return;
            }
        }

        // Anti-overlap: kleinere abgedeckte Areas raus, sowohl im Hot-Cache als auch in der DB.
        const evictedKeys: string[] = [];
        const survivors: CachedArea<T>[] = [];
        for (const existing of areas) {
            const dist = haversineDistance(existing.center, area.center);
            if (dist + existing.radiusM <= area.radiusM) {
                evictedKeys.push(existing.cacheKey);
            } else {
                survivors.push(existing);
            }
        }
        if (evictedKeys.length > 0) {
            await this.prisma.geoAreaCache.deleteMany({
                where: {
                    discriminant: area.discriminant,
                    cacheKey: { in: evictedKeys },
                },
            });
            if (isRuntimeLogVerbose()) {
                console.log(
                    `[PersistentAreaCache] EVICT: ${evictedKeys.length} smaller areas swallowed by new`
                );
            }
        }

        const bbox = circleToBBox(area.center.lat, area.center.lng, area.radiusM);
        const expiresAt = BigInt(Date.now() + ttlMs);

        // Upsert auf (discriminant, cacheKey) — aber das Schema hat id als PK.
        // Wir delete+create, um Dubletten bei identischem cacheKey zu vermeiden.
        await this.prisma.geoAreaCache.deleteMany({
            where: {
                discriminant: area.discriminant,
                cacheKey: area.cacheKey,
            },
        });
        await this.prisma.geoAreaCache.create({
            data: {
                discriminant: area.discriminant,
                centerLat: area.center.lat,
                centerLng: area.center.lng,
                radiusM: area.radiusM,
                bboxMinLat: bbox.minLat,
                bboxMinLng: bbox.minLng,
                bboxMaxLat: bbox.maxLat,
                bboxMaxLng: bbox.maxLng,
                cacheKey: area.cacheKey,
                payload: JSON.stringify(area.data),
                cachedAt: BigInt(area.cachedAt),
                expiresAt,
            },
        });

        survivors.push(area);
        this.partitions.set(area.discriminant, survivors);

        if (isRuntimeLogVerbose()) {
            console.log(
                `[PersistentAreaCache] STORED '${area.discriminant}' (${area.center.lat},${area.center.lng} r=${area.radiusM}m, total in partition: ${survivors.length})`
            );
        }
    }

    async prune(): Promise<void> {
        const now = BigInt(Date.now());
        const res = await this.prisma.geoAreaCache.deleteMany({
            where: { expiresAt: { lte: now } },
        });
        if (res.count > 0) {
            // Hot-Cache invalidieren, damit die naechste Load frische Daten holt.
            this.loadedPartitions.clear();
            this.partitions.clear();
            if (isRuntimeLogVerbose()) {
                console.log(
                    `[PersistentAreaCache] PRUNED: ${res.count} expired areas`
                );
            }
        }
    }
}
