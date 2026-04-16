/**
 * =========================================================================
 *  OSM LANDMARKS RETRIEVER — dredgin' landmarks from the cartographic abyss
 * =========================================================================
 *
 *  Arr, this vessel sails the cursed waters of OpenStreetMap, retrievin'
 *  landmarks that lurk near a given coordinate. From brooding gulfs are
 *  we beheld, by that which bears no name — and so we query the Overpass
 *  API, that eldritch oracle of geographic horror.
 *
 *  Its heralds are the stars it fells, the sky and Earth aflame.
 *  Through endless faces, countless forms, a multitude unfolds —
 *  each landmark a whisper from the deep.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable, type IAreaCache, type IAreaCacheable, type CachedArea, geoBucketKey, GEO_CACHE_TTL_OSM_MS } from "@datadogs/core";
import { NearbyLandmarksPact, type OsmLandmarksQueryInput } from "./pacts";
import {
    clampRadiusM,
    fetchNearbyLandmarks,
    parseLandmarkFacets,
    LandmarksOverpassFacet,
    DEFAULT_LANDMARKS_FACETS,
    ALL_LANDMARKS_OVERPASS_FACETS,
    DEFAULT_LANDMARK_RADIUS_M,
    MAX_LANDMARK_RADIUS_M,
    OsmLandmarkElementType,
    type OsmLandmarksResult,
    type OsmLandmarkElement,
} from "./overpassLandmarks";

/**
 * Arr, the OsmLandmarksRetriever — a hound that dredges landmarks from the
 * cartographic abyss of OpenStreetMap! From brooding gulfs it queries the
 * Overpass API, that eldritch oracle, returnin' nodes and ways no mortal
 * cartographer was meant to catalogue. The void yields its secrets, matey,
 * through endless faces countless forms, each landmark a whisper from the deep.
 */
/**
 * Haversine distance between two points in meters — used for area-cache filtering.
 */
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

/**
 * Filter landmark elements to only those within a given radius from center.
 */
function filterElementsByRadius(elements: OsmLandmarkElement[], lat: number, lng: number, radiusM: number): OsmLandmarkElement[] {
    return elements.filter(el => {
        if (el.lat == null || el.lng == null) return true;
        return haversineDistanceM({ lat, lng }, { lat: el.lat, lng: el.lng }) <= radiusM;
    });
}

export class OsmLandmarksRetriever extends Dog<OsmLandmarksResult> implements ICacheable, IAreaCacheable<OsmLandmarksResult> {
    private cacheHandler?: ICacheHandler;
    private areaCache?: IAreaCache<OsmLandmarksResult>;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    setAreaCache(cache: IAreaCache<OsmLandmarksResult>): void {
        this.areaCache = cache;
    }

    /** Arr, the name by which the abyss calls this landmark-huntin' hound */
    get name(): string {
        return OsmLandmarksRetriever.name;
    }

    get description(): string {
        return 'Finds nearby OSM landmarks (tourism, historic, museums, peaks, cemeteries, bridges, nature, amenities, …) via Overpass — use preset "full" or list facets.';
    }

    /** The sigil branded upon our vessel by cosmic forces beyond comprehension */
    get icon(): string | undefined {
        return "\uD83C\uDFDB\uFE0F";
    }

    /** The pact that binds us — an eldritch accord with the query provider, matey */
    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [NearbyLandmarksPact];
    }

    /** No optional horrors burden this crew */
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    /** Carry the Overpass toolkit into the VM so SerializedDog children can use them */
    getVmContextContributions(): Record<string, any> {
        return {
            LandmarksOverpassFacet,
            DEFAULT_LANDMARKS_FACETS,
            ALL_LANDMARKS_OVERPASS_FACETS,
            DEFAULT_LANDMARK_RADIUS_M,
            MAX_LANDMARK_RADIUS_M,
            OsmLandmarkElementType,
        };
    }

    /**
     * Arr, plunder the nearby landmarks from the Overpass abyss!
     * Area-cache aware: if a larger area was already cached, filter down instead of re-fetching.
     */
    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<OsmLandmarksResult> => {
        const queryDog = season.exhausted.find((d) => this.matchesParent(NearbyLandmarksPact, d));
        const query =
            (queryDog?.collected as OsmLandmarksQueryInput | undefined) ?? ({} as OsmLandmarksQueryInput);

        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampRadiusM(parseFloat(query.radius ?? ""));
        const facets = parseLandmarkFacets(query.preset);

        if (Number.isNaN(lat) || Number.isNaN(lng)) {
            throw new Error("OsmLandmarksRetriever: Missing required query params (lat, lng)");
        }

        const discriminant = `landmarks:${[...facets].sort().join(',')}`;

        // Check area cache first — does a larger cached area already cover this query?
        if (this.areaCache) {
            const covering = await this.areaCache.findCovering({ lat, lng }, radiusM, discriminant);
            if (covering) {
                const filtered = filterElementsByRadius(covering.data.elements, lat, lng, radiusM);
                return { center: { lat, lng }, radiusM, preset: facets, elements: filtered };
            }
        }

        const key = geoBucketKey("landmarks", lat, lng, radiusM, { extras: { facets: [...facets].sort().join(",") } });

        const fetchLandmarks = async (): Promise<OsmLandmarksResult> => {
            const result = await fetchNearbyLandmarks(lat, lng, radiusM, facets);

            // Store in area cache for future containment checks
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
            return this.cacheHandler.getOrFetch(key, GEO_CACHE_TTL_OSM_MS, fetchLandmarks);
        }
        return fetchLandmarks();
    };
}
