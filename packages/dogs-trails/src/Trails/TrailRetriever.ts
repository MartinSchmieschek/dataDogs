import {
    Dog,
    IHuntingDog,
    IHuntingSeason,
    type ICacheHandler,
    type ICacheable,
    type IAreaCache,
    type IAreaCacheable,
    geoBucketKey,
} from "@datadogs/core";
import { getBaseDogIcon } from "@datadogs/core";
import { TrailQueryPact, type TrailQuery } from "./pacts";

const OVERPASS_URL = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";
const DEFAULT_RADIUS_M = 3000;
const MAX_RADIUS_M = 15000;
// Overpass is slow under load; we ask for 90s server-side and allow 100s client-side.
const OVERPASS_SERVER_TIMEOUT_S = 90;
const OVERPASS_CLIENT_TIMEOUT_MS = 100_000;

export type TrailType = "hiking" | "bicycle" | "both";

export type LatLon = { lat: number; lon: number };

export interface TrailElement {
    id: number;
    type: "way" | "relation";
    name?: string;
    trailType: "hiking" | "bicycle";
    distance?: string;
    surface?: string;
    /**
     * Flat list of coordinates for legacy consumers. For ways this is the full path.
     * For relations the member-way segments are concatenated end-to-end — usable, but
     * may jump between disconnected segments. Prefer `segments` when drawing polylines.
     */
    coordinates: LatLon[];
    /** Structured polylines: one entry per way (relations yield one entry per member-way). */
    segments: LatLon[][];
    tags: Record<string, string>;
}

/**
 * The trail hunt's yield. Besides the collected trails, it ships **functions** the consumer
 * can invoke in the VM to reshape the catch — points into lines, lines into GeoJSON, etc.
 * Functions survive the VM context between waves; they are stripped when the response is
 * finally JSON-serialised to the browser, which is fine — by then the renderer dog has
 * already used them to build HTML.
 */
export interface TrailResult {
    center: { lat: number; lng: number };
    radiusM: number;
    trailType: TrailType;
    trails: TrailElement[];
    /** Resolve a single trail element into its polyline segments. */
    toPolylines: (element: TrailElement) => LatLon[][];
    /** Resolve every collected trail into `{ id, name, trailType, segments }`. */
    resolveAll: () => Array<{
        id: number;
        name?: string;
        trailType: "hiking" | "bicycle";
        segments: LatLon[][];
    }>;
    /** Build a GeoJSON FeatureCollection of all trails — for maps that speak the standard. */
    toGeoJSON: () => {
        type: "FeatureCollection";
        features: Array<{
            type: "Feature";
            geometry: { type: "LineString" | "MultiLineString"; coordinates: any };
            properties: Record<string, any>;
        }>;
    };
}

function clampRadius(parsed: number): number {
    if (isNaN(parsed) || parsed < 1) return DEFAULT_RADIUS_M;
    return Math.min(Math.round(parsed), MAX_RADIUS_M);
}

function parseTrailType(raw?: string): TrailType {
    if (!raw) return "both";
    const v = raw.toLowerCase();
    if (v === "hiking" || v === "walking" || v === "foot") return "hiking";
    if (v === "bicycle" || v === "cycling" || v === "bike") return "bicycle";
    return "both";
}

function buildOverpassQuery(lat: number, lng: number, radiusM: number, trailType: TrailType): string {
    const lines: string[] = [];

    if (trailType === "hiking" || trailType === "both") {
        lines.push(`  relation["route"="hiking"](around:${radiusM},${lat},${lng});`);
        lines.push(`  relation["route"="foot"](around:${radiusM},${lat},${lng});`);
        lines.push(`  way["highway"="path"]["foot"!="no"](around:${radiusM},${lat},${lng});`);
        lines.push(`  way["highway"="footway"](around:${radiusM},${lat},${lng});`);
    }

    if (trailType === "bicycle" || trailType === "both") {
        lines.push(`  relation["route"="bicycle"](around:${radiusM},${lat},${lng});`);
        lines.push(`  way["highway"="cycleway"](around:${radiusM},${lat},${lng});`);
        lines.push(`  way["highway"="path"]["bicycle"="yes"](around:${radiusM},${lat},${lng});`);
        lines.push(`  way["highway"="track"]["bicycle"="yes"](around:${radiusM},${lat},${lng});`);
    }

    // `out geom` inlines {lat,lon} arrays on ways and on relation members — no recurse-down
    // and no node-map reconstruction needed. Relations carry their member-way geometries
    // directly, which is exactly what we need to turn routes into polylines.
    return `[out:json][timeout:${OVERPASS_SERVER_TIMEOUT_S}];
(
${lines.join("\n")}
);
out geom;`;
}

interface OverpassMember {
    type: string;
    ref: number;
    role: string;
    geometry?: LatLon[];
}

interface OverpassElement {
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    tags?: Record<string, string>;
    members?: OverpassMember[];
    nodes?: number[];
    geometry?: LatLon[];
}

/** Pull the first visible error sentence out of an Overpass HTML error body. */
function extractOverpassError(body: string): string {
    const match = body.match(/<p[^>]*>\s*(?:<strong[^>]*>[^<]*<\/strong>\s*:?\s*)?([^<]{5,300})<\/p>/i);
    if (match && match[1]) return match[1].trim();
    const stripped = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return stripped.slice(0, 200);
}

function classifyTrailType(tags: Record<string, string>): "hiking" | "bicycle" {
    const route = tags["route"] ?? "";
    if (route === "bicycle") return "bicycle";
    if (route === "hiking" || route === "foot") return "hiking";

    const highway = tags["highway"] ?? "";
    if (highway === "cycleway") return "bicycle";
    if (tags["bicycle"] === "yes" && highway !== "footway") return "bicycle";

    return "hiking";
}

export class TrailRetriever extends Dog<TrailResult> implements ICacheable, IAreaCacheable<TrailResult> {
    private cacheHandler?: ICacheHandler;
    private areaCache?: IAreaCache<TrailResult>;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    setAreaCache(cache: IAreaCache<TrailResult>): void {
        this.areaCache = cache;
    }

    get name(): string {
        return TrailRetriever.name;
    }

    get description(): string {
        return "Finds nearby hiking trails and cycling routes via the Overpass/OpenStreetMap API.";
    }

    get icon(): string | undefined {
        return getBaseDogIcon(TrailRetriever.name);
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [TrailQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<TrailResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(TrailQueryPact, d));
        const query = (queryDog?.collected as TrailQuery | undefined) ?? ({} as TrailQuery);

        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampRadius(parseFloat(query.radius ?? ""));
        const trailType = parseTrailType(query.type);

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error("TrailRetriever: Missing required query params (lat, lng)");
        }

        // Grid-bucket the coordinates so nearby queries share a cache key;
        // area-cache catches the subset-containment cases on top of that.
        const discriminant = `trails:${trailType}`;
        const key = geoBucketKey("trails", lat, lng, radiusM, { extras: { type: trailType } });

        if (this.areaCache) {
            const covering = this.areaCache.findCovering({ lat, lng }, radiusM, discriminant);
            if (covering) {
                // A larger area already covers this query — reuse it. We don't
                // filter trails by radius; Overpass already returned everything
                // in the surrounding area, and the renderer can clip on its own.
                return covering.data;
            }
        }

        const fetchTrails = async (): Promise<TrailResult> => {
            const overpassQuery = buildOverpassQuery(lat, lng, radiusM, trailType);
            const userAgent =
                process.env.OVERPASS_USER_AGENT ??
                "jsonAggregator/TrailRetriever (contact: set OVERPASS_USER_AGENT)";

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), OVERPASS_CLIENT_TIMEOUT_MS);

            let res: Response;
            try {
                res = await fetch(OVERPASS_URL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                        "User-Agent": userAgent,
                    },
                    body: `data=${encodeURIComponent(overpassQuery)}`,
                    signal: controller.signal,
                });
            } finally {
                clearTimeout(timer);
            }

            // Overpass returns its runtime errors (timeout, rate limit, bad query) as
            // HTTP 200 with an HTML body. `res.ok` is not enough — inspect the body.
            const rawBody = await res.text();
            if (!res.ok) {
                throw new Error(
                    `TrailRetriever: Overpass HTTP ${res.status} ${res.statusText}${rawBody ? ` — ${rawBody.slice(0, 200)}` : ""}`
                );
            }
            const contentType = res.headers.get("content-type") ?? "";
            const looksLikeHtml = rawBody.trimStart().startsWith("<");
            if (!contentType.includes("json") || looksLikeHtml) {
                const hint = extractOverpassError(rawBody);
                throw new Error(
                    `TrailRetriever: Overpass returned non-JSON (${contentType || "no content-type"})${hint ? ` — ${hint}` : ""}`
                );
            }

            let json: { elements?: OverpassElement[] };
            try {
                json = JSON.parse(rawBody) as { elements?: OverpassElement[] };
            } catch (err: any) {
                throw new Error(`TrailRetriever: Overpass JSON parse failed — ${err?.message || err}`);
            }
            const rawElements = json.elements ?? [];

            // Extract ways and relations with tags (actual trails).
            // `out geom` gives us inline geometries, so no node-map is needed.
            const seen = new Set<string>();
            const trails: TrailElement[] = [];

            for (const el of rawElements) {
                if (el.type !== "way" && el.type !== "relation") continue;
                if (!el.tags || Object.keys(el.tags).length === 0) continue;

                const dedupKey = `${el.type}/${el.id}`;
                if (seen.has(dedupKey)) continue;
                seen.add(dedupKey);

                const segments: LatLon[][] = [];
                if (el.type === "way" && Array.isArray(el.geometry)) {
                    if (el.geometry.length >= 2) segments.push(el.geometry);
                } else if (el.type === "relation" && Array.isArray(el.members)) {
                    for (const member of el.members) {
                        if (member.type !== "way" || !Array.isArray(member.geometry)) continue;
                        if (member.geometry.length >= 2) segments.push(member.geometry);
                    }
                }

                // Flat `coordinates` for legacy consumers — concatenated segments.
                const coordinates: LatLon[] = ([] as LatLon[]).concat(...segments);

                const tags = el.tags;
                trails.push({
                    id: el.id,
                    type: el.type as "way" | "relation",
                    name: tags["name"],
                    trailType: classifyTrailType(tags),
                    distance: tags["distance"],
                    surface: tags["surface"],
                    coordinates,
                    segments,
                    tags,
                });
            }

            // Helper functions bundled into the yield — consumers (renderer dogs, etc.)
            // can invoke them inside the VM context to reshape the catch on demand.
            const toPolylines = (element: TrailElement): LatLon[][] => {
                if (!element) return [];
                if (Array.isArray(element.segments) && element.segments.length > 0) {
                    return element.segments.filter(seg => Array.isArray(seg) && seg.length >= 2);
                }
                if (Array.isArray(element.coordinates) && element.coordinates.length >= 2) {
                    return [element.coordinates];
                }
                return [];
            };

            const resolveAll = () =>
                trails.map(t => ({
                    id: t.id,
                    name: t.name,
                    trailType: t.trailType,
                    segments: toPolylines(t),
                }));

            const toGeoJSON = () => ({
                type: "FeatureCollection" as const,
                features: trails.map(t => {
                    const polylines = toPolylines(t);
                    const isMulti = polylines.length !== 1;
                    return {
                        type: "Feature" as const,
                        geometry: isMulti
                            ? {
                                type: "MultiLineString" as const,
                                coordinates: polylines.map(seg => seg.map(p => [p.lon, p.lat])),
                            }
                            : {
                                type: "LineString" as const,
                                coordinates: (polylines[0] ?? []).map(p => [p.lon, p.lat]),
                            },
                        properties: {
                            id: t.id,
                            name: t.name,
                            trailType: t.trailType,
                            surface: t.surface,
                            distance: t.distance,
                            osmType: t.type,
                        },
                    };
                }),
            });

            const result: TrailResult = {
                center: { lat, lng },
                radiusM,
                trailType,
                trails,
                toPolylines,
                resolveAll,
                toGeoJSON,
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
            const cached = await this.cacheHandler.getOrFetch(key, 6 * 60 * 60_000, fetchTrails);
            // Persistent caches (PrismaCacheHandler) serialise with JSON.stringify,
            // which strips the helper functions. Re-attach them so consumers always
            // see the full API regardless of where the hit came from.
            return ensureTrailHelpers(cached);
        }
        return fetchTrails();
    };
}

/**
 * Re-attach the yield helper functions after a persistent cache round-trip.
 * Idempotent — if the helpers are already present (in-memory cache hit), leaves
 * the object untouched.
 */
function ensureTrailHelpers(result: TrailResult): TrailResult {
    if (typeof result.toPolylines === "function" && typeof result.resolveAll === "function") {
        return result;
    }
    const trails = result.trails ?? [];
    const toPolylines = (element: TrailElement): LatLon[][] => {
        if (!element) return [];
        if (Array.isArray(element.segments) && element.segments.length > 0) {
            return element.segments.filter(seg => Array.isArray(seg) && seg.length >= 2);
        }
        if (Array.isArray(element.coordinates) && element.coordinates.length >= 2) {
            return [element.coordinates];
        }
        return [];
    };
    const resolveAll = () =>
        trails.map(t => ({
            id: t.id,
            name: t.name,
            trailType: t.trailType,
            segments: toPolylines(t),
        }));
    const toGeoJSON = () => ({
        type: "FeatureCollection" as const,
        features: trails.map(t => {
            const polylines = toPolylines(t);
            const isMulti = polylines.length !== 1;
            return {
                type: "Feature" as const,
                geometry: isMulti
                    ? {
                        type: "MultiLineString" as const,
                        coordinates: polylines.map(seg => seg.map(p => [p.lon, p.lat])),
                    }
                    : {
                        type: "LineString" as const,
                        coordinates: (polylines[0] ?? []).map(p => [p.lon, p.lat]),
                    },
                properties: {
                    id: t.id,
                    name: t.name,
                    trailType: t.trailType,
                    surface: t.surface,
                    distance: t.distance,
                    osmType: t.type,
                },
            };
        }),
    });
    return { ...result, toPolylines, resolveAll, toGeoJSON };
}
