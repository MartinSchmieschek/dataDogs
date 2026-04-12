/**
 * OSM highway ways → GeoJSON line geometries.
 */

import {
    Dog,
    IHuntingDog,
    IHuntingSeason,
    getBaseDogIcon,
    type ICacheHandler,
    type ICacheable,
    type IAreaCache,
    type IAreaCacheable,
    geoBucketKey,
} from "@datadogs/core";
import { OsmStreetsGeometryPact, type OsmStreetsGeometryQueryInput } from "./osmGeometryPacts";
import { parseOsmHighwayList, type OsmHighwayValue } from "./osmGeometryEnums";
import {
    buildStreetsOverpassQuery,
    circleToBoundingBox,
    clampGeometryRadiusM,
    fetchOverpassGeometry,
    overpassJsonToGeoJson,
    type BoundingBox,
} from "./overpassGeometryCore";
import type { FeatureCollection, GeometryObject } from "geojson";

export interface OsmStreetsGeometryResult {
    center: { lat: number; lng: number };
    radiusM: number;
    bbox: BoundingBox;
    highway: OsmHighwayValue[];
    geojson: FeatureCollection<GeometryObject>;
}

export class OsmStreetsGeometryRetriever
    extends Dog<OsmStreetsGeometryResult>
    implements ICacheable, IAreaCacheable<OsmStreetsGeometryResult>
{
    private cacheHandler?: ICacheHandler;
    private areaCache?: IAreaCache<OsmStreetsGeometryResult>;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    setAreaCache(cache: IAreaCache<OsmStreetsGeometryResult>): void {
        this.areaCache = cache;
    }

    get name(): string {
        return OsmStreetsGeometryRetriever.name;
    }

    get icon(): string | undefined {
        return getBaseDogIcon(OsmStreetsGeometryRetriever.name);
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [OsmStreetsGeometryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<OsmStreetsGeometryResult> => {
        const queryDog = season.exhausted.find((d) => this.matchesParent(OsmStreetsGeometryPact, d));
        const query =
            (queryDog?.collected as OsmStreetsGeometryQueryInput | undefined) ??
            ({} as OsmStreetsGeometryQueryInput);

        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampGeometryRadiusM(parseFloat(query.radius ?? ""));
        const highway = parseOsmHighwayList(query.highway, query.preset);

        if (Number.isNaN(lat) || Number.isNaN(lng)) {
            throw new Error("OsmStreetsGeometryRetriever: Missing required query params (lat, lng)");
        }

        const facetKey = [...highway].sort().join(",");
        const discriminant = `streetsGeometry:${facetKey}`;
        const key = geoBucketKey("streetsGeometry", lat, lng, radiusM, { extras: { hw: facetKey } });

        if (this.areaCache) {
            const covering = this.areaCache.findCovering({ lat, lng }, radiusM, discriminant);
            if (covering) return covering.data;
        }

        const fetchStreets = async (): Promise<OsmStreetsGeometryResult> => {
            const bbox = circleToBoundingBox(lat, lng, radiusM);
            const overpassQuery = buildStreetsOverpassQuery(bbox, highway, 120);
            const osmJson = await fetchOverpassGeometry(overpassQuery, 240000);
            const geojson = overpassJsonToGeoJson(osmJson);

            const result: OsmStreetsGeometryResult = {
                center: { lat, lng },
                radiusM,
                bbox,
                highway,
                geojson,
            };

            if (this.areaCache) {
                this.areaCache.store({
                    center: { lat, lng },
                    radiusM,
                    data: result,
                    cacheKey: key,
                    cachedAt: Date.now(),
                    discriminant,
                });
            }

            return result;
        };

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 6 * 60 * 60_000, fetchStreets);
        }
        return fetchStreets();
    };
}
