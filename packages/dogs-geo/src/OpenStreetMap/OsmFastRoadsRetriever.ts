import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable, type IAreaCache, type IAreaCacheable, geoBucketKey, GEO_CACHE_TTL_OSM_MS } from "@datadogs/core";
import { NearbyFastRoadsPact, type OsmFastRoadsQueryInput } from "./pacts";
import {
    clampFastRoadsRadiusM,
    fetchNearbyFastRoads,
    parseFastRoadsFacets,
    FastRoadsOverpassFacet,
    DEFAULT_FAST_ROADS_FACETS,
    DEFAULT_FAST_ROADS_RADIUS_M,
    MAX_FAST_ROADS_RADIUS_M,
    type OsmFastRoadsResult,
} from "./overpassFastRoads";
import type { OsmGeoElement } from "./overpassOsmShared";

function haversineDistanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6_371_000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h = sinDLat * sinDLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
    return 2 * R * Math.asin(Math.sqrt(h));
}

function filterElementsByRadius(elements: OsmGeoElement[], lat: number, lng: number, radiusM: number): OsmGeoElement[] {
    return elements.filter((el) => {
        if (el.lat == null || el.lng == null) return true;
        return haversineDistanceM({ lat, lng }, { lat: el.lat, lng: el.lng }) <= radiusM;
    });
}

export class OsmFastRoadsRetriever extends Dog<OsmFastRoadsResult> implements ICacheable, IAreaCacheable<OsmFastRoadsResult> {
    private cacheHandler?: ICacheHandler;
    private areaCache?: IAreaCache<OsmFastRoadsResult>;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    setAreaCache(cache: IAreaCache<OsmFastRoadsResult>): void {
        this.areaCache = cache;
    }

    get name(): string {
        return OsmFastRoadsRetriever.name;
    }

    get description(): string {
        return "Finds nearby OSM fast roads (motorway, trunk, primary, …) via Overpass — use a modest radius; many segments in dense areas.";
    }

    get icon(): string | undefined {
        return "\uD83D\uDEE3\uFE0F";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [NearbyFastRoadsPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    getVmContextContributions(): Record<string, any> {
        return {
            FastRoadsOverpassFacet,
            DEFAULT_FAST_ROADS_FACETS,
            DEFAULT_FAST_ROADS_RADIUS_M,
            MAX_FAST_ROADS_RADIUS_M,
        };
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<OsmFastRoadsResult> => {
        const queryDog = season.exhausted.find((d) => this.matchesParent(NearbyFastRoadsPact, d));
        const query = (queryDog?.collected as OsmFastRoadsQueryInput | undefined) ?? ({} as OsmFastRoadsQueryInput);

        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampFastRoadsRadiusM(parseFloat(query.radius ?? ""));
        const facets = parseFastRoadsFacets(query.preset);

        if (Number.isNaN(lat) || Number.isNaN(lng)) {
            throw new Error("OsmFastRoadsRetriever: Missing required query params (lat, lng)");
        }

        const discriminant = `fastRoads:${[...facets].sort().join(",")}`;

        if (this.areaCache) {
            const covering = await this.areaCache.findCovering({ lat, lng }, radiusM, discriminant);
            if (covering) {
                const filtered = filterElementsByRadius(covering.data.elements, lat, lng, radiusM);
                return { center: { lat, lng }, radiusM, preset: facets, elements: filtered };
            }
        }

        const key = geoBucketKey("fastRoads", lat, lng, radiusM, { extras: { facets: [...facets].sort().join(",") } });

        const fetchRoads = async (): Promise<OsmFastRoadsResult> => {
            const result = await fetchNearbyFastRoads(lat, lng, radiusM, facets);

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
            return this.cacheHandler.getOrFetch(key, GEO_CACHE_TTL_OSM_MS, fetchRoads);
        }
        return fetchRoads();
    };
}
