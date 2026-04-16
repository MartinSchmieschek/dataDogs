/**
 * OSM forest / landuse / natural area polygons → GeoJSON (full geometry).
 */

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable, type IAreaCache, type IAreaCacheable, geoBucketKey, GEO_CACHE_TTL_OSM_MS } from "@datadogs/core";
import { OsmForestGeometryPact, type OsmForestGeometryQueryInput } from "./osmGeometryPacts";
import { parseOsmLanduseList, parseOsmNaturalList, OsmLanduseValue, OsmNaturalValue } from "./osmGeometryEnums";
import {
    buildForestAreaOverpassQuery,
    circleToBoundingBox,
    clampGeometryRadiusM,
    fetchOverpassGeometry,
    overpassJsonToGeoJson,
    type BoundingBox,
} from "./overpassGeometryCore";
import type { FeatureCollection, GeometryObject } from "geojson";

export interface OsmForestPolygonsResult {
    center: { lat: number; lng: number };
    radiusM: number;
    bbox: BoundingBox;
    landuse: OsmLanduseValue[];
    natural: OsmNaturalValue[];
    geojson: FeatureCollection<GeometryObject>;
}

export class OsmForestPolygonsRetriever
    extends Dog<OsmForestPolygonsResult>
    implements ICacheable, IAreaCacheable<OsmForestPolygonsResult>
{
    private cacheHandler?: ICacheHandler;
    private areaCache?: IAreaCache<OsmForestPolygonsResult>;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    setAreaCache(cache: IAreaCache<OsmForestPolygonsResult>): void {
        this.areaCache = cache;
    }

    get name(): string {
        return OsmForestPolygonsRetriever.name;
    }

    get icon(): string | undefined {
        return undefined;
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [OsmForestGeometryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<OsmForestPolygonsResult> => {
        const queryDog = season.exhausted.find((d) => this.matchesParent(OsmForestGeometryPact, d));
        const query =
            (queryDog?.collected as OsmForestGeometryQueryInput | undefined) ??
            ({} as OsmForestGeometryQueryInput);

        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampGeometryRadiusM(parseFloat(query.radius ?? ""));
        const landuse = parseOsmLanduseList(query.landuse);
        const natural = parseOsmNaturalList(query.natural);

        if (Number.isNaN(lat) || Number.isNaN(lng)) {
            throw new Error("OsmForestPolygonsRetriever: Missing required query params (lat, lng)");
        }

        const facetKey = [
            `lu=${[...landuse].sort().join(",")}`,
            `nat=${[...natural].sort().join(",")}`,
        ].join("|");
        const discriminant = `forestPolygons:${facetKey}`;
        const key = geoBucketKey("forestPolygons", lat, lng, radiusM, { extras: { f: facetKey } });

        if (this.areaCache) {
            const covering = await this.areaCache.findCovering({ lat, lng }, radiusM, discriminant);
            if (covering) return covering.data;
        }

        const fetchPolygons = async (): Promise<OsmForestPolygonsResult> => {
            const bbox = circleToBoundingBox(lat, lng, radiusM);
            const overpassQuery = buildForestAreaOverpassQuery(bbox, landuse, natural, 180);
            const osmJson = await fetchOverpassGeometry(overpassQuery, 300000);
            const geojson = overpassJsonToGeoJson(osmJson);

            const result: OsmForestPolygonsResult = {
                center: { lat, lng },
                radiusM,
                bbox,
                landuse,
                natural,
                geojson,
            };

            if (this.areaCache) {
                await this.areaCache.store({
                    center: { lat, lng },
                    radiusM,
                    data: result,
                    cacheKey: key,
                    cachedAt: Date.now(),
                    discriminant,
                }, GEO_CACHE_TTL_OSM_MS);
            }

            return result;
        };

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, GEO_CACHE_TTL_OSM_MS, fetchPolygons);
        }
        return fetchPolygons();
    };
}
