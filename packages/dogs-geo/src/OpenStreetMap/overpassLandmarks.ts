/**
 * =========================================================================
 *  OVERPASS LANDMARKS — the eldritch cartography of OpenStreetMap
 * =========================================================================
 *
 *  Arr, matey! This cursed module communes with the Overpass API, that
 *  ancient oracle dwellin' in the deepest trenches of the OSM abyss.
 *  Roiling, moaning, this realm of ours, in madness lost shall die —
 *  but first we shall plunder every landmark, facet, and node from
 *  its writhing depths.
 *
 *  Carrion hordes trill their profane accord with eldritch plans,
 *  and each Overpass query be another verse in the void's hymnal.
 *
 *  In luminous space blackened stars, they gaze, accuse, deny.
 * =========================================================================
 */

// Arr, the gateway to the Overpass abyss — all queries pass through this cursed URL
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

/** Arr, the default search radius in meters — how far the crew dares cast its net into the deep */
export const DEFAULT_LANDMARK_RADIUS_M = 500;
/** The maximum search radius in meters, matey — beyond this the eldritch void consumes all who venture */
export const MAX_LANDMARK_RADIUS_M = 5000;

/**
 * OSM facets for the Overpass query — each one a different face of the eldritch deep.
 * Through endless faces, countless forms, a multitude unfolds.
 * The pact declares which categories shall be dredged from the abyss.
 */
export enum LandmarksOverpassFacet {
    /** Arr, tourism sites — inns, attractions, and plunder-worthy destinations from the deep */
    Tourism = "tourism",
    /** Historic landmarks, matey — relics from ages when the void was young and nameless */
    Historic = "historic",
    /** Museums — cursed halls where eldritch artefacts be hoarded by carrion hordes */
    Museum = "museum",
    /** Peaks — the highest points where one might glimpse the brooding gulfs above the abyss */
    Peak = "peak",
}

/** The default facets, arr — Tourism and Historic, as the old crew always sailed */
export const DEFAULT_LANDMARKS_FACETS: readonly LandmarksOverpassFacet[] = [
    LandmarksOverpassFacet.Tourism,
    LandmarksOverpassFacet.Historic,
];

/** @deprecated Arr, use LandmarksOverpassFacet instead — this name be lost to the deep */
export type LandmarksPreset = LandmarksOverpassFacet;

/** OSM element types from the Overpass response — the forms the void takes when it answers */
export enum OsmLandmarkElementType {
    /** Arr, a single point in the void — the simplest form the abyss takes */
    Node = "node",
    /** A way, matey — a line of connected nodes, like the tentacles of an eldritch beast */
    Way = "way",
    /** A relation — a cosmic grouping of elements, bound by corporeal laws unwritten */
    Relation = "relation",
}

/** A single landmark element dredged from the abyss */
export interface OsmLandmarkElement {
    /** Arr, the element type — which form the void chose to manifest this landmark */
    type: OsmLandmarkElementType;
    /** The unique OSM identifier, matey — a number branded upon this entity by the abyss */
    id: number;
    /** Latitude of the landmark — where upon the cursed map this horror dwells */
    lat: number;
    /** Longitude of the landmark — the east-west bearing through the eldritch deep */
    lon: number;
    /** The name whispered by the void, if it deigns to speak — not all horrors be named, arr */
    name?: string;
    /** OSM tags — eldritch metadata dredged from brooding gulfs, key-value pairs of cosmic knowledge */
    tags: Record<string, string>;
}

/** The full plunder of a landmarks query — center, radius, and the eldritch elements within */
export interface OsmLandmarksResult {
    /** Arr, the center coordinate from whence the search emanated into the abyss */
    center: { lat: number; lng: number };
    /** The search radius in meters, matey — how far the crew cast its net into the void */
    radiusM: number;
    /** The normalized facets used in the query — which faces of the void we dared gaze upon */
    preset: LandmarksOverpassFacet[];
    /** The landmark elements plundered from the deep — each one a whisper from the eldritch cartography */
    elements: OsmLandmarkElement[];
}

/** Raw Overpass element — the unprocessed whispers from the deep */
interface OverpassElement {
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
}

// Arr, each facet maps to its own Overpass query line — eldritch incantations for the API
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

/**
 * Arr, purge duplicate facets from the list — the void despises repetition,
 * for to cosmic madness laws submit, though stalwart minds entreat.
 */
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

/**
 * Arr, attempt to coerce an unknown value into a valid facet —
 * the deep speaks in many tongues, and we must translate, matey.
 */
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
 * Parse the `preset` from the query — be it an array of facets, a legacy
 * string like "landmarks" or "extended", or a single eldritch facet name.
 * From brooding gulfs are we beheld, by that which bears no name.
 * @param raw - The raw preset value whispered from the void — could be string, array, or unknown horror
 * @returns An array of validated facets — the faces of the abyss we dare query, matey
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
        // Arr, the default — same as the old "landmarks" preset from simpler times
        if (v === "" || v === "landmarks") return base;
        // "extended" summons all facets — tourism, historic, museum, and peak — the full horror
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

/**
 * @deprecated Arr, use parseLandmarkFacets — this old name be claimed by the abyss
 * @param raw - The raw preset value from the deep — a string, facet, or undefined void
 * @returns Parsed facets, arr — same as parseLandmarkFacets, for the void cares not which name ye call
 */
export function parseLandmarksPreset(raw: string | LandmarksOverpassFacet | undefined): LandmarksOverpassFacet[] {
    return parseLandmarkFacets(raw);
}

/**
 * Arr, forge the Overpass query — an incantation written in the tongue of the void.
 * Its heralds are the stars it fells, the sky and Earth aflame.
 * @param lat - Latitude of the search center — the heart of the eldritch circle
 * @param lng - Longitude of the search center, matey — east-west bearing into the deep
 * @param radiusM - Search radius in meters — how far the void's incantation reaches
 * @param facets - Which faces of the abyss to query — the categories of horror we seek
 * @returns The Overpass QL query string — a profane incantation for the cartographic void
 */
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

/**
 * Arr, transform a raw Overpass element into our typed form —
 * givin' shape to the shapeless, name to the nameless.
 * Corporeal laws are unwritten, as suns and love retreat.
 */
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
    // Arr, coordinates may lurk directly on the element or hide in its center
    if (el.lat != null && el.lon != null) {
        lat = el.lat;
        lon = el.lon;
    } else if (el.center) {
        lat = el.center.lat;
        lon = el.center.lon;
    }
    // If no coordinates be found, the element is lost to the void — return null
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

/**
 * Arr, clamp the search radius — we dare not cast our net too wide
 * into the abyss, lest we summon horrors beyond reckonin'.
 * @param parsed - The parsed radius value — may be NaN if the void swallowed the input
 * @returns A safe radius in meters, matey — clamped between the boundaries of the deep
 */
export function clampRadiusM(parsed: number): number {
    if (Number.isNaN(parsed) || parsed < 1) {
        return DEFAULT_LANDMARK_RADIUS_M;
    }
    return Math.min(Math.round(parsed), MAX_LANDMARK_RADIUS_M);
}

/**
 * Arr, the main plunder operation! Fetch nearby landmarks from the
 * Overpass abyss. We build the query, send it into the deep, and
 * parse whatever eldritch response crawls back.
 *
 * To cosmic forms from tangent planes, we end as we began —
 * deduplicatin' elements so no horror is counted twice, matey.
 * @param lat - Latitude of the search center — the epicenter of our cartographic horror
 * @param lng - Longitude of the search center — east-west coordinate into the void
 * @param radiusM - Search radius in meters, arr — the boundary of our eldritch net
 * @param facets - Which facets of the deep to query — the categories of landmarks we dare plunder
 * @returns The full landmarks result — center, radius, facets, and the dredged elements from the abyss
 */
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

    // Arr, set a timeout — we won't wait forever in the void's embrace
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

    // If the abyss returns an error, we surface the horror for all to see
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
            `OsmLandmarksRetriever: Overpass HTTP ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ""}`
        );
    }

    // Parse the response and deduplicate — the void often echoes, matey
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
