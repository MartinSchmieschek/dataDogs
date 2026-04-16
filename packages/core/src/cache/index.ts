/**
 * ~~~ THE CACHE MANIFEST ~~~
 *
 * All cache contracts, assembled from the deep.
 */

export { ICacheHandler } from './ICacheHandler';
export { ICacheable, isCacheable } from './ICacheable';
export { IAreaCache, IAreaCacheable, isAreaCacheable, CachedArea, GeoBBox } from './IAreaCache';
export { geoBucketKey, geoBucketCenter, defaultGeoBucketM, type GeoBucketOptions } from './geoBucket';
export { GEO_CACHE_TTL_OSM_MS, GEO_CACHE_TTL_WEATHER_MS, GEO_CACHE_TTL_AIR_QUALITY_MS } from './geoCacheTtl';
