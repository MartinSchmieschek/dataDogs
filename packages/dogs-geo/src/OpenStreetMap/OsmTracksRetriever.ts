import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable, type IAreaCache, type IAreaCacheable, geoBucketKey, GEO_CACHE_TTL_OSM_MS } from "@datadogs/core";
import { NearbyTracksPact, type OsmTracksQueryInput } from "./pacts";
import {
    clampTracksRadiusM,
    fetchNearbyTracks,
    parseTracksFacets,
    TracksOverpassFacet,
    DEFAULT_TRACKS_FACETS,
    DEFAULT_TRACKS_RADIUS_M,
    MAX_TRACKS_RADIUS_M,
    type OsmTracksResult,
} from "./overpassTracks";
import type { OsmGeoElement } from "./overpassOsmShared";
import { getBaseDogIcon } from "@datadogs/core";

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

export class OsmTracksRetriever extends Dog<OsmTracksResult> implements ICacheable, IAreaCacheable<OsmTracksResult> {
    private cacheHandler?: ICacheHandler;
    private areaCache?: IAreaCache<OsmTracksResult>;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    setAreaCache(cache: IAreaCache<OsmTracksResult>): void {
        this.areaCache = cache;
    }

    get name(): string {
        return OsmTracksRetriever.name;
    }

    get description(): string {
        return "Finds nearby OSM ways (path, footway, cycleway, track, …) via Overpass — use a modest radius; results can be large.";
    }

    get icon(): string | undefined {
        return getBaseDogIcon(OsmTracksRetriever.name);
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [NearbyTracksPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    getVmContextContributions(): Record<string, any> {
        return {
            TracksOverpassFacet,
            DEFAULT_TRACKS_FACETS,
            DEFAULT_TRACKS_RADIUS_M,
            MAX_TRACKS_RADIUS_M,
        };
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<OsmTracksResult> => {
        const queryDog = season.exhausted.find((d) => this.matchesParent(NearbyTracksPact, d));
        const query = (queryDog?.collected as OsmTracksQueryInput | undefined) ?? ({} as OsmTracksQueryInput);

        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampTracksRadiusM(parseFloat(query.radius ?? ""));
        const facets = parseTracksFacets(query.preset);

        if (Number.isNaN(lat) || Number.isNaN(lng)) {
            throw new Error("OsmTracksRetriever: Missing required query params (lat, lng)");
        }

        const discriminant = `tracks:${[...facets].sort().join(",")}`;

        if (this.areaCache) {
            const covering = await this.areaCache.findCovering({ lat, lng }, radiusM, discriminant);
            if (covering) {
                const filtered = filterElementsByRadius(covering.data.elements, lat, lng, radiusM);
                return { center: { lat, lng }, radiusM, preset: facets, elements: filtered };
            }
        }

        const key = geoBucketKey("tracks", lat, lng, radiusM, { extras: { facets: [...facets].sort().join(",") } });

        const fetchTracks = async (): Promise<OsmTracksResult> => {
            const result = await fetchNearbyTracks(lat, lng, radiusM, facets);

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
            return this.cacheHandler.getOrFetch(key, GEO_CACHE_TTL_OSM_MS, fetchTracks);
        }
        return fetchTracks();
    };
}
