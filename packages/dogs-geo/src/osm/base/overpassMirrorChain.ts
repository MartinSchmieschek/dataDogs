/**
 * ~~~ OVERPASS MIRROR CHAIN — resilient fetch across multiple interpreters ~~~
 *
 * Der public overpass-api.de Endpoint kippt unter Last haeufig mit HTTP 504
 * oder mit "HTTP 200 + HTML error". Die Mirror-Kette probiert darum mehrere
 * Interpreter durch, bis einer sauber antwortet. Reihenfolge:
 *
 *   1. $OVERPASS_URLS (Komma-Liste) oder $OVERPASS_URL (single)
 *   2. osm.ch (Swiss OSM Community) — meist schnellste Antwortzeiten in DACH
 *   3. lz4 / kumi Fallbacks
 *   4. overpass-api.de (offizieller Public-Endpoint)
 *
 * Retry-Strategie: AbortError, Netzwerk, HTTP 429/5xx, Non-JSON-Bodies gelten
 * als transient und eskalieren zum naechsten Mirror. HTTP 400 (Bad Query) und
 * Parse-Fehler bubbeln sofort durch — bei denen hilft kein anderer Server.
 *
 * Ein zentrales Modul fuer alle OSM-Dogs: kein copy-paste von fetch-Schleifen
 * mehr in jeden einzelnen Retriever.
 */

const DEFAULT_OVERPASS_QUERY_TIMEOUT_SEC = 120;
const MIN_OVERPASS_FETCH_TIMEOUT_MS = 10_000;

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

/** Overpass-Server-Timeout (`[timeout:N]`). Env: OVERPASS_QUERY_TIMEOUT_SEC. */
export function getOverpassQueryTimeoutSec(): number {
    return parseEnvPositiveInt("OVERPASS_QUERY_TIMEOUT_SEC", DEFAULT_OVERPASS_QUERY_TIMEOUT_SEC);
}

/** HTTP-Client-Abort-Budget. Muss den Server-Timeout uebersteigen. */
export function getOverpassFetchTimeoutMs(): number {
    const fromEnv = process.env.OVERPASS_FETCH_TIMEOUT_MS;
    if (fromEnv != null && fromEnv !== "") {
        const n = parseInt(fromEnv, 10);
        if (Number.isFinite(n) && n >= MIN_OVERPASS_FETCH_TIMEOUT_MS) return n;
    }
    return (getOverpassQueryTimeoutSec() + 60) * 1000;
}

/** Gebaute Mirror-Kette: Env-Overrides vorn, hardcoded Fallbacks hinten, dedupliziert. */
export function getOverpassUrlChain(): string[] {
    const chain: string[] = [];
    const multi = process.env.OVERPASS_URLS;
    if (multi) {
        for (const u of multi.split(",").map((s) => s.trim()).filter(Boolean)) chain.push(u);
    } else {
        const single = process.env.OVERPASS_URL;
        if (single) chain.push(single);
    }
    for (const u of FALLBACK_OVERPASS_URLS) chain.push(u);
    return Array.from(new Set(chain));
}

export interface OverpassRawElement {
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
    members?: Array<{
        type: string;
        ref: number;
        role: string;
        geometry?: Array<{ lat: number; lon: number }>;
    }>;
    nodes?: number[];
    geometry?: Array<{ lat: number; lon: number }>;
}

/** Zieht den ersten sichtbaren Fehler-Satz aus einer HTML-Error-Antwort. */
function extractOverpassError(body: string): string {
    const match = body.match(/<p[^>]*>\s*(?:<strong[^>]*>[^<]*<\/strong>\s*:?\s*)?([^<]{5,300})<\/p>/i);
    if (match && match[1]) return match[1].trim();
    const stripped = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return stripped.slice(0, 200);
}

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
    userAgentLabel: string,
): Promise<OverpassRawElement[]> {
    const userAgent =
        process.env.OVERPASS_USER_AGENT ??
        `dataDogs/${userAgentLabel} (contact: set OVERPASS_USER_AGENT)`;

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
            `${userAgentLabel}: Overpass HTTP ${res.status} ${res.statusText}${rawBody ? ` — ${rawBody.slice(0, 200)}` : ""}`
        );
    }
    const contentType = res.headers.get("content-type") ?? "";
    const looksLikeHtml = rawBody.trimStart().startsWith("<");
    if (!contentType.includes("json") || looksLikeHtml) {
        const hint = extractOverpassError(rawBody);
        throw new Error(
            `${userAgentLabel}: Overpass returned non-JSON (${contentType || "no content-type"})${hint ? ` — ${hint}` : ""}`
        );
    }

    let json: { elements?: OverpassRawElement[] };
    try {
        json = JSON.parse(rawBody) as { elements?: OverpassRawElement[] };
    } catch (err: any) {
        throw new Error(`${userAgentLabel}: Overpass JSON parse failed — ${err?.message || err}`);
    }
    return json.elements ?? [];
}

/**
 * Zentrale Fetch-Funktion: haemmert die Overpass-Query durch die Mirror-Kette,
 * bis einer sauber antwortet. Transient-Fehler springen zum naechsten Mirror,
 * permanente Fehler (Bad-Query, Parse) bubbeln sofort durch.
 */
export async function fetchOverpassElementsWithFallback(
    overpassQuery: string,
    userAgentLabel: string,
): Promise<OverpassRawElement[]> {
    const urls = getOverpassUrlChain();
    const fetchTimeoutMs = getOverpassFetchTimeoutMs();
    const errors: string[] = [];

    for (let i = 0; i < urls.length; i++) {
        const url = urls[i]!;
        try {
            return await fetchOverpassOnce(url, overpassQuery, fetchTimeoutMs, userAgentLabel);
        } catch (err: any) {
            const label = `${url}: ${err?.message ?? err}`;
            errors.push(label);
            if (!isRetryableOverpassError(err) || i === urls.length - 1) {
                if (errors.length === 1) throw err;
                throw new Error(
                    `${userAgentLabel}: all Overpass mirrors failed — ${errors.join(" | ")}`
                );
            }
        }
    }

    throw new Error(`${userAgentLabel}: no Overpass URL configured`);
}

/** Einheitlicher `[out:json][timeout:N];`-Header. */
export function overpassSettingsHeader(): string {
    return `[out:json][timeout:${getOverpassQueryTimeoutSec()}];`;
}

/** Representativer Punkt aus einem Overpass-Element, zieht `lat/lon` oder `center`. */
export function overpassElementRepresentativePoint(
    el: OverpassRawElement,
): { lat: number; lng: number } | null {
    if (el.lat != null && el.lon != null) return { lat: el.lat, lng: el.lon };
    if (el.center) return { lat: el.center.lat, lng: el.center.lon };
    return null;
}
