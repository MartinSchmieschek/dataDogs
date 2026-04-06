/**
 * Shared Overpass fetch + element mapping for OSM geo retrievers (landmarks, tracks, vegetation).
 */

export const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export const DEFAULT_OSM_RADIUS_M = 500;
export const MAX_OSM_RADIUS_M = 5000;

/** Default server-side Overpass execution cap (seconds) — `[timeout:N]` in QL */
export const DEFAULT_OVERPASS_QUERY_TIMEOUT_SEC = 120;

function parseEnvPositiveInt(name: string, fallback: number): number {
    const v = process.env[name];
    if (v == null || v === "") return fallback;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Overpass `[timeout:N]` (server max runtime). Env: `OVERPASS_QUERY_TIMEOUT_SEC` (default 120).
 */
export function getOverpassQueryTimeoutSec(): number {
    return parseEnvPositiveInt("OVERPASS_QUERY_TIMEOUT_SEC", DEFAULT_OVERPASS_QUERY_TIMEOUT_SEC);
}

/**
 * HTTP client abort budget — should exceed `getOverpassQueryTimeoutSec()` (network + server).
 * Env: `OVERPASS_FETCH_TIMEOUT_MS` (optional). Default: query timeout + 60s margin.
 */
export function getOverpassFetchTimeoutMs(): number {
    const fromEnv = process.env.OVERPASS_FETCH_TIMEOUT_MS;
    if (fromEnv != null && fromEnv !== "") {
        const n = parseInt(fromEnv, 10);
        if (Number.isFinite(n) && n >= 10_000) return n;
    }
    return (getOverpassQueryTimeoutSec() + 60) * 1000;
}

/** First line of every Overpass QL body: `[out:json][timeout:N];` */
export function overpassSettingsHeader(): string {
    return `[out:json][timeout:${getOverpassQueryTimeoutSec()}];`;
}

export enum OsmGeoElementType {
    Node = "node",
    Way = "way",
    Relation = "relation",
}

/** A node, way, or relation with a representative point and tags */
export interface OsmGeoElement {
    type: OsmGeoElementType;
    id: number;
    lat: number;
    lon: number;
    name?: string;
    tags: Record<string, string>;
}

interface OverpassElement {
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
}

export function mapOverpassElement(el: OverpassElement): OsmGeoElement | null {
    if (
        el.type !== OsmGeoElementType.Node &&
        el.type !== OsmGeoElementType.Way &&
        el.type !== OsmGeoElementType.Relation
    ) {
        return null;
    }
    let lat: number | undefined;
    let lon: number | undefined;
    if (el.lat != null && el.lon != null) {
        lat = el.lat;
        lon = el.lon;
    } else if (el.center) {
        lat = el.center.lat;
        lon = el.center.lon;
    }
    if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) {
        return null;
    }
    const tags = el.tags ?? {};
    const name = tags["name"];
    return {
        type: el.type as OsmGeoElementType,
        id: el.id,
        lat,
        lon,
        ...(name ? { name } : {}),
        tags,
    };
}

export function clampOsmRadiusM(parsed: number, defaultM = DEFAULT_OSM_RADIUS_M, maxM = MAX_OSM_RADIUS_M): number {
    if (Number.isNaN(parsed) || parsed < 1) {
        return defaultM;
    }
    return Math.min(Math.round(parsed), maxM);
}

/**
 * POST Overpass interpreter; returns deduped elements. `userAgentLabel` appears in default User-Agent.
 */
export async function fetchOverpassElements(query: string, userAgentLabel: string): Promise<OsmGeoElement[]> {
    const userAgent =
        process.env.OVERPASS_USER_AGENT ?? `jsonAggregator/${userAgentLabel} (contact: set OVERPASS_USER_AGENT)`;

    const controller = new AbortController();
    const timeoutMs = getOverpassFetchTimeoutMs();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Awaited<ReturnType<typeof fetch>>;
    try {
        res = await fetch(OVERPASS_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": userAgent,
            },
            body: `data=${encodeURIComponent(query)}`,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timer);
    }

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
            `${userAgentLabel}: Overpass HTTP ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ""}`
        );
    }

    const json = (await res.json()) as { elements?: OverpassElement[] };
    const rawElements = json.elements ?? [];
    const seen = new Set<string>();
    const elements: OsmGeoElement[] = [];

    for (const raw of rawElements) {
        const mapped = mapOverpassElement(raw);
        if (!mapped) continue;
        const key = `${mapped.type}/${mapped.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        elements.push(mapped);
    }

    return elements;
}
