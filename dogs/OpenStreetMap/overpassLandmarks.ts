const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export const DEFAULT_LANDMARK_RADIUS_M = 500;
export const MAX_LANDMARK_RADIUS_M = 5000;

/**
 * OSM-Facetten für die Overpass-Abfrage (String-Enum, Pact/Mimic/JSON).
 * Der Pact listet hier, welche Kategorien mitabgefragt werden.
 */
export enum LandmarksOverpassFacet {
    Tourism = "tourism",
    Historic = "historic",
    Museum = "museum",
    Peak = "peak",
}

/** Standard wie früher „Landmarks“: tourism + historic. */
export const DEFAULT_LANDMARKS_FACETS: readonly LandmarksOverpassFacet[] = [
    LandmarksOverpassFacet.Tourism,
    LandmarksOverpassFacet.Historic,
];

/** @deprecated Nutze LandmarksOverpassFacet. */
export type LandmarksPreset = LandmarksOverpassFacet;

/** OSM-Elementtypen aus der Overpass-Antwort. */
export enum OsmLandmarkElementType {
    Node = "node",
    Way = "way",
    Relation = "relation",
}

export interface OsmLandmarkElement {
    type: OsmLandmarkElementType;
    id: number;
    lat: number;
    lon: number;
    name?: string;
    tags: Record<string, string>;
}

export interface OsmLandmarksResult {
    center: { lat: number; lng: number };
    radiusM: number;
    /** Normalisierte Facetten, die in der Abfrage verwendet wurden. */
    preset: LandmarksOverpassFacet[];
    elements: OsmLandmarkElement[];
}

interface OverpassElement {
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
}

const OVERPASS_LINE_BY_FACET: Record<LandmarksOverpassFacet, (r: number, lat: number, lng: number) => string> =
    {
        [LandmarksOverpassFacet.Tourism]: (r, lat, lng) =>
            `  nwr["tourism"](around:${r},${lat},${lng});`,
        [LandmarksOverpassFacet.Historic]: (r, lat, lng) =>
            `  nwr["historic"](around:${r},${lat},${lng});`,
        [LandmarksOverpassFacet.Museum]: (r, lat, lng) =>
            `  nwr["amenity"="museum"](around:${r},${lat},${lng});`,
        [LandmarksOverpassFacet.Peak]: (r, lat, lng) =>
            `  nwr["natural"="peak"](around:${r},${lat},${lng});`,
    };

function dedupeFacets(facets: LandmarksOverpassFacet[]): LandmarksOverpassFacet[] {
    const seen = new Set<LandmarksOverpassFacet>();
    const out: LandmarksOverpassFacet[] = [];
    for (const f of facets) {
        if (seen.has(f)) continue;
        seen.add(f);
        out.push(f);
    }
    return out;
}

function coerceFacet(raw: unknown): LandmarksOverpassFacet | null {
    if (typeof raw !== "string") {
        if (
            raw === LandmarksOverpassFacet.Tourism ||
            raw === LandmarksOverpassFacet.Historic ||
            raw === LandmarksOverpassFacet.Museum ||
            raw === LandmarksOverpassFacet.Peak
        ) {
            return raw;
        }
        return null;
    }
    const v = raw.toLowerCase();
    for (const facet of Object.values(LandmarksOverpassFacet) as LandmarksOverpassFacet[]) {
        if (facet === v) return facet;
    }
    return null;
}

/**
 * Liest `preset` aus dem Query-Dog: Array von Facetten, oder Legacy-String
 * `landmarks` / `extended`.
 */
export function parseLandmarkFacets(raw: unknown): LandmarksOverpassFacet[] {
    const base = [...DEFAULT_LANDMARKS_FACETS];
    if (raw == null) return base;
    if (Array.isArray(raw)) {
        const mapped: LandmarksOverpassFacet[] = [];
        for (const item of raw) {
            const f = coerceFacet(item);
            if (f != null) mapped.push(f);
        }
        return mapped.length ? dedupeFacets(mapped) : base;
    }
    if (typeof raw === "string") {
        const v = raw.toLowerCase();
        if (v === "" || v === "landmarks") return base;
        if (v === "extended") {
            return dedupeFacets([
                ...base,
                LandmarksOverpassFacet.Museum,
                LandmarksOverpassFacet.Peak,
            ]);
        }
        const one = coerceFacet(raw);
        return one != null ? [one] : base;
    }
    const single = coerceFacet(raw);
    return single != null ? [single] : base;
}

/** @deprecated Nutze parseLandmarkFacets. */
export function parseLandmarksPreset(raw: string | LandmarksOverpassFacet | undefined): LandmarksOverpassFacet[] {
    return parseLandmarkFacets(raw);
}

export function buildLandmarksOverpassQuery(
    lat: number,
    lng: number,
    radiusM: number,
    facets: LandmarksOverpassFacet[]
): string {
    const r = radiusM;
    const list = facets.length ? dedupeFacets(facets) : [...DEFAULT_LANDMARKS_FACETS];
    const lines = list.map((f) => OVERPASS_LINE_BY_FACET[f](r, lat, lng));
    return `[out:json][timeout:25];
(
${lines.join("\n")}
);
out center;`;
}

function mapOverpassElement(el: OverpassElement): OsmLandmarkElement | null {
    if (
        el.type !== OsmLandmarkElementType.Node &&
        el.type !== OsmLandmarkElementType.Way &&
        el.type !== OsmLandmarkElementType.Relation
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
        type: el.type as OsmLandmarkElementType,
        id: el.id,
        lat,
        lon,
        ...(name ? { name } : {}),
        tags,
    };
}

export function clampRadiusM(parsed: number): number {
    if (Number.isNaN(parsed) || parsed < 1) {
        return DEFAULT_LANDMARK_RADIUS_M;
    }
    return Math.min(Math.round(parsed), MAX_LANDMARK_RADIUS_M);
}

export async function fetchNearbyLandmarks(
    lat: number,
    lng: number,
    radiusM: number,
    facets: LandmarksOverpassFacet[]
): Promise<OsmLandmarksResult> {
    const normalized = facets.length ? dedupeFacets(facets) : [...DEFAULT_LANDMARKS_FACETS];
    const query = buildLandmarksOverpassQuery(lat, lng, radiusM, normalized);
    const userAgent =
        process.env.OVERPASS_USER_AGENT ??
        "jsonAggregator/OsmLandmarksRetriever (contact: set OVERPASS_USER_AGENT)";

    const controller = new AbortController();
    const timeoutMs = 30000;
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
            `OsmLandmarksRetriever: Overpass HTTP ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ""}`
        );
    }

    const json = (await res.json()) as { elements?: OverpassElement[] };
    const rawElements = json.elements ?? [];
    const seen = new Set<string>();
    const elements: OsmLandmarkElement[] = [];

    for (const raw of rawElements) {
        const mapped = mapOverpassElement(raw);
        if (!mapped) continue;
        const key = `${mapped.type}/${mapped.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        elements.push(mapped);
    }

    return {
        center: { lat, lng },
        radiusM,
        preset: normalized,
        elements,
    };
}
