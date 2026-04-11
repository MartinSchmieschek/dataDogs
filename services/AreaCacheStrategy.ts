/**
 * ~~~ THE AREA CACHE STRATEGY — territorial memory of the geo-hounds ~~~
 *
 * Arr, the geo-hounds hunt by territory — circles and polygons
 * charted across the cartographic abyss. This strategy remembers
 * which waters have already been plundered, so smaller queries
 * that fall within an already-cached expanse need not sail again.
 *
 * Anti-overlap: when a new area swallows an existing one,
 * the smaller territory is cast overboard. When an existing
 * area already covers the new query, we skip storing.
 * No overlapping territories clutter this hold.
 */

import { IAreaCache, CachedArea, isRuntimeLogVerbose } from '@datadogs/core';

/**
 * Calculate the haversine distance between two coordinates in meters.
 * The formula of the deep — how far apart two points be on this cursed sphere.
 */
export function haversineDistance(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number }
): number {
    const R = 6_371_000; // Earth's radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);

    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);

    const h = sinDLat * sinDLat +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;

    return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Ray-casting point-in-polygon test.
 * Arr, does the point lie within the cursed polygon's borders?
 */
export function pointInPolygon(
    lat: number,
    lng: number,
    polygon: [number, number][]
): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [yi, xi] = polygon[i];
        const [yj, xj] = polygon[j];
        if (
            yi > lat !== yj > lat &&
            lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
        ) {
            inside = !inside;
        }
    }
    return inside;
}

/**
 * Filter elements that have lat/lon properties to only those within a given radius.
 * Used to trim results from a larger cached area down to a smaller query circle.
 */
export function filterByRadius<T extends { lat?: number; lon?: number }>(
    elements: T[],
    centerLat: number,
    centerLng: number,
    radiusM: number
): T[] {
    return elements.filter(el => {
        if (el.lat == null || el.lon == null) return true; // keep elements without coords
        const dist = haversineDistance(
            { lat: centerLat, lng: centerLng },
            { lat: el.lat, lng: el.lon }
        );
        return dist <= radiusM;
    });
}

export class AreaCacheStrategy<T> implements IAreaCache<T> {
    private areas: CachedArea<T>[] = [];

    findCovering(
        center: { lat: number; lng: number },
        radiusM: number,
        discriminant: string
    ): CachedArea<T> | undefined {
        for (const area of this.areas) {
            if (area.discriminant !== discriminant) continue;

            // Circle-in-circle check: distance between centers + query radius <= cached radius
            const dist = haversineDistance(center, area.center);
            if (dist + radiusM <= area.radiusM) {
                if (isRuntimeLogVerbose()) {
                    console.log(`[AreaCache] HIT: query (${center.lat},${center.lng} r=${radiusM}m) covered by cached (${area.center.lat},${area.center.lng} r=${area.radiusM}m)`);
                }
                return area;
            }
        }
        return undefined;
    }

    store(area: CachedArea<T>): void {
        // Check if already covered by an existing area — skip if so
        for (const existing of this.areas) {
            if (existing.discriminant !== area.discriminant) continue;
            const dist = haversineDistance(area.center, existing.center);
            if (dist + area.radiusM <= existing.radiusM) {
                if (isRuntimeLogVerbose()) {
                    console.log(`[AreaCache] SKIP: new area already covered by existing (${existing.center.lat},${existing.center.lng} r=${existing.radiusM}m)`);
                }
                return;
            }
        }

        // Anti-overlap: evict smaller areas that the new one fully contains
        this.areas = this.areas.filter(existing => {
            if (existing.discriminant !== area.discriminant) return true;
            const dist = haversineDistance(existing.center, area.center);
            if (dist + existing.radiusM <= area.radiusM) {
                if (isRuntimeLogVerbose()) {
                    console.log(`[AreaCache] EVICT: smaller area (${existing.center.lat},${existing.center.lng} r=${existing.radiusM}m) swallowed by new`);
                }
                return false;
            }
            return true;
        });

        this.areas.push(area);
        if (isRuntimeLogVerbose()) {
            console.log(`[AreaCache] STORED: (${area.center.lat},${area.center.lng} r=${area.radiusM}m) [${area.discriminant}] (total: ${this.areas.length})`);
        }
    }

    prune(now: number, ttlMs: number): void {
        const before = this.areas.length;
        this.areas = this.areas.filter(a => a.cachedAt + ttlMs > now);
        const evicted = before - this.areas.length;
        if (evicted > 0 && isRuntimeLogVerbose()) {
            console.log(`[AreaCache] PRUNED: ${evicted} expired areas`);
        }
    }
}
