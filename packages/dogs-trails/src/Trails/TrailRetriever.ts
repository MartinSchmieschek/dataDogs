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

const DEFAULT_RADIUS_M = 3000;
const MAX_RADIUS_M = 15000;

const DEFAULT_OVERPASS_QUERY_TIMEOUT_SEC = 120;
const MIN_OVERPASS_FETCH_TIMEOUT_MS = 10_000;

// Mirror-Kette fuer Overpass. Reihenfolge = Prioritaet. osm.ch (Swiss OSM Community)
// hat in mehreren Messungen die kuerzesten Antwortzeiten und sitzt geographisch nah
// an den typischen Hunt-Zielen (DACH). lz4 und kumi sind die klassischen Backup-
// Mirror; der offizielle Public-Endpoint kommt zuletzt, weil er unter Last am
// haeufigsten mit HTTP 504 / "HTTP 200 + HTML" kippt. Der User kann per
// OVERPASS_URL / OVERPASS_URLS aus der Env vorne anstellen — die Fallbacks bleiben
// als Sicherungsnetz immer am Ende der Kette.
const FALLBACK_OVERPASS_URLS = [
    "https://overpass.osm.ch/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
];

function parseEnvPositiveInt(name: string, fallback: number): number {
    const v = process.env[name];
    if (v == null || v === "") return fallback;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getOverpassQueryTimeoutSec(): number {
    return parseEnvPositiveInt("OVERPASS_QUERY_TIMEOUT_SEC", DEFAULT_OVERPASS_QUERY_TIMEOUT_SEC);
}

function getOverpassFetchTimeoutMs(): number {
    const fromEnv = process.env.OVERPASS_FETCH_TIMEOUT_MS;
    if (fromEnv != null && fromEnv !== "") {
        const n = parseInt(fromEnv, 10);
        if (Number.isFinite(n) && n >= MIN_OVERPASS_FETCH_TIMEOUT_MS) return n;
    }
    return (getOverpassQueryTimeoutSec() + 60) * 1000;
}

/**
 * Build the mirror chain. `OVERPASS_URL` (single) or `OVERPASS_URLS` (comma-separated)
 * override the primary; the hardcoded fallbacks are appended so a transient failure
 * on one mirror still has somewhere to go. Dupes are removed while preserving order.
 */
function getOverpassUrlChain(): string[] {
    const chain: string[] = [];
    const multi = process.env.OVERPASS_URLS;
    if (multi) {
        for (const u of multi.split(",").map(s => s.trim()).filter(Boolean)) chain.push(u);
    } else {
        const single = process.env.OVERPASS_URL;
        if (single) chain.push(single);
    }
    for (const u of FALLBACK_OVERPASS_URLS) chain.push(u);
    return Array.from(new Set(chain));
}

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
    return `[out:json][timeout:${getOverpassQueryTimeoutSec()}];
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

/**
 * Errors we consider transient — worth trying the next mirror for. Covers AbortError
 * (client timeout), network errors, HTTP 429/5xx, and Overpass' "HTTP 200 + HTML error"
 * quirk. Anything else (e.g. a 400 bad-query) is raised immediately — no point in
 * retrying a broken request against a different server.
 */
function isRetryableOverpassError(err: unknown): boolean {
    if (!err) return false;
    const e = err as { name?: string; message?: string; code?: string };
    if (e.name === "AbortError") return true;
    const msg = (e.message ?? "").toLowerCase();
    if (!msg) return false;
    if (msg.includes("fetch failed") || msg.includes("network") || msg.includes("econn") || msg.includes("etimedout")) return true;
    if (msg.includes("returned non-json")) return true;
    if (/http\s+(5\d\d|429|408)/.test(msg)) return true;
    return false;
}

async function fetchOverpassOnce(
    url: string,
    overpassQuery: string,
    fetchTimeoutMs: number,
): Promise<OverpassElement[]> {
    const userAgent =
        process.env.OVERPASS_USER_AGENT ??
        "jsonAggregator/TrailRetriever (contact: set OVERPASS_USER_AGENT)";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), fetchTimeoutMs);

    let res: Response;
    try {
        res = await fetch(url, {
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
    return json.elements ?? [];
}

/**
 * Walk the mirror chain until one server answers cleanly. Retryable errors escalate
 * to the next mirror; permanent errors (400, parse failures) bubble up immediately.
 * If every mirror fails we throw a combined error describing each attempt.
 */
async function fetchOverpassElementsWithFallback(overpassQuery: string): Promise<OverpassElement[]> {
    const urls = getOverpassUrlChain();
    const fetchTimeoutMs = getOverpassFetchTimeoutMs();
    const errors: string[] = [];

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i]!;
        try {
            return await fetchOverpassOnce(url, overpassQuery, fetchTimeoutMs);
        } catch (err: any) {
            const label = `${url}: ${err?.message ?? err}`;
            errors.push(label);
            if (!isRetryableOverpassError(err) || i === urls.length - 1) {
                if (errors.length === 1) throw err;
                throw new Error(
                    `TrailRetriever: all Overpass mirrors failed — ${errors.join(" | ")}`
                );
            }
        }
    }

    // Unreachable — the loop either returns or throws.
    throw new Error("TrailRetriever: no Overpass URL configured");
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
            const rawElements = await fetchOverpassElementsWithFallback(overpassQuery);

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
