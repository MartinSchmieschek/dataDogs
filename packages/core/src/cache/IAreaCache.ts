/**
 * ~~~ THE AREA CACHE PACT ~~~
 *
 * Arr, the geo-hounds hunt by territory -- circles and polygons
 * carved into the cartographic abyss. This pact governs
 * area-based caching so no two overlapping territories
 * clutter the hold. When a smaller query falls within
 * an already-cached expanse, the cache yields its plunder
 * without sailing the same waters twice.
 */

/** A cached geographic area with its associated data. */
export interface CachedArea<T> {
    /** The center of the cached query area */
    center: { lat: number; lng: number };
    /** The radius in meters (for circle-based queries) */
    radiusM: number;
    /** Optional polygon boundary (for isochrone results) */
    polygon?: [number, number][];
    /** The cached result data */
    data: T;
    /** Cache key of the entry */
    cacheKey: string;
    /** When this area was cached (Date.now()) */
    cachedAt: number;
    /** Discriminant ensures only same-type queries are compared (e.g. "landmarks:Historic,Tourism") */
    discriminant: string;
}

export interface IAreaCache<T> {
    /**
     * Check if a query area is fully contained within an already-cached area.
     * Returns the cached data if contained, or undefined if not.
     * Only areas with matching discriminant are considered.
     */
    findCovering(
        center: { lat: number; lng: number },
        radiusM: number,
        discriminant: string
    ): CachedArea<T> | undefined;

    /**
     * Register a new cached area.
     * Anti-overlap: if the new area fully contains existing areas
     * with the same discriminant, the smaller ones are evicted.
     * If an existing area already covers the new one, skip storing.
     */
    store(area: CachedArea<T>): void;

    /** Remove expired areas. */
    prune(now: number, ttlMs: number): void;
}

/** A dog that opts into area-based caching. */
export interface IAreaCacheable<T> {
    setAreaCache(cache: IAreaCache<T>): void;
}

/** Type-guard: checks if a dog implements IAreaCacheable. */
export function isAreaCacheable(dog: unknown): dog is IAreaCacheable<unknown> {
    return typeof (dog as any)?.setAreaCache === 'function';
}
