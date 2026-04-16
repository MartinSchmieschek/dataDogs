import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable, type IAreaCache, type IAreaCacheable, geoBucketKey, GEO_CACHE_TTL_OSM_MS } from "@datadogs/core";
import { NearbyVegetationPact, type OsmVegetationQueryInput } from "./pacts";
import {
    clampVegetationRadiusM,
    fetchNearbyVegetation,
    parseVegetationFacets,
    VegetationOverpassFacet,
    DEFAULT_VEGETATION_FACETS,
    DEFAULT_VEGETATION_RADIUS_M,
    MAX_VEGETATION_RADIUS_M,
    type OsmVegetationResult,
} from "./overpassVegetation";
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

export class OsmVegetationRetriever extends Dog<OsmVegetationResult> implements ICacheable, IAreaCacheable<OsmVegetationResult> {
    private cacheHandler?: ICacheHandler;
    private areaCache?: IAreaCache<OsmVegetationResult>;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    setAreaCache(cache: IAreaCache<OsmVegetationResult>): void {
        this.areaCache = cache;
    }

    get name(): string {
        return OsmVegetationRetriever.name;
    }

    get description(): string {
        return "Finds nearby OSM vegetation / landcover (wood, forest, meadow, park, …) via Overpass — polygons can be large; prefer smaller radii.";
    }

    get icon(): string | undefined {
        return "\uD83C\uDF33";
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [NearbyVegetationPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    getVmContextContributions(): Record<string, any> {
        return {
            VegetationOverpassFacet,
            DEFAULT_VEGETATION_FACETS,
            DEFAULT_VEGETATION_RADIUS_M,
            MAX_VEGETATION_RADIUS_M,
        };
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<OsmVegetationResult> => {
        const queryDog = season.exhausted.find((d) => this.matchesParent(NearbyVegetationPact, d));
        const query = (queryDog?.collected as OsmVegetationQueryInput | undefined) ?? ({} as OsmVegetationQueryInput);

        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampVegetationRadiusM(parseFloat(query.radius ?? ""));
        const facets = parseVegetationFacets(query.preset);

        if (Number.isNaN(lat) || Number.isNaN(lng)) {
            throw new Error("OsmVegetationRetriever: Missing required query params (lat, lng)");
        }

        const discriminant = `vegetation:${[...facets].sort().join(",")}`;

        if (this.areaCache) {
            const covering = await this.areaCache.findCovering({ lat, lng }, radiusM, discriminant);
            if (covering) {
                const filtered = filterElementsByRadius(covering.data.elements, lat, lng, radiusM);
                return { center: { lat, lng }, radiusM, preset: facets, elements: filtered };
            }
        }

        const key = geoBucketKey("vegetation", lat, lng, radiusM, { extras: { facets: [...facets].sort().join(",") } });

        const fetchVeg = async (): Promise<OsmVegetationResult> => {
            const result = await fetchNearbyVegetation(lat, lng, radiusM, facets);

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
            return this.cacheHandler.getOrFetch(key, GEO_CACHE_TTL_OSM_MS, fetchVeg);
        }
        return fetchVeg();
    };
}
