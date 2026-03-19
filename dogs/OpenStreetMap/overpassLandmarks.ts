const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export const DEFAULT_LANDMARK_RADIUS_M = 500;
export const MAX_LANDMARK_RADIUS_M = 5000;

export type LandmarksPreset = "landmarks" | "extended";

export interface OsmLandmarkElement {
    type: "node" | "way" | "relation";
    id: number;
    lat: number;
    lon: number;
    name?: string;
    tags: Record<string, string>;
}

export interface OsmLandmarksResult {
    center: { lat: number; lng: number };
    radiusM: number;
    preset: LandmarksPreset;
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

export function buildLandmarksOverpassQuery(
    lat: number,
    lng: number,
    radiusM: number,
    preset: LandmarksPreset
): string {
    const r = radiusM;
    const lines: string[] = [
        `  nwr["tourism"](around:${r},${lat},${lng});`,
        `  nwr["historic"](around:${r},${lat},${lng});`,
    ];
    if (preset === "extended") {
        lines.push(`  nwr["amenity"="museum"](around:${r},${lat},${lng});`);
        lines.push(`  nwr["natural"="peak"](around:${r},${lat},${lng});`);
    }
    return `[out:json][timeout:25];
(
${lines.join("\n")}
);
out center;`;
}

function mapOverpassElement(el: OverpassElement): OsmLandmarkElement | null {
    if (el.type !== "node" && el.type !== "way" && el.type !== "relation") {
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
        type: el.type,
        id: el.id,
        lat,
        lon,
        ...(name ? { name } : {}),
        tags,
    };
}

export function parseLandmarksPreset(raw: string | undefined): LandmarksPreset {
    const v = (raw ?? "").toLowerCase();
    if (v === "extended") return "extended";
    return "landmarks";
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
    preset: LandmarksPreset
): Promise<OsmLandmarksResult> {
    const query = buildLandmarksOverpassQuery(lat, lng, radiusM, preset);
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
        preset,
        elements,
    };
}
