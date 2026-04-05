import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@datadogs/core";
import { getBaseDogIcon } from "@datadogs/core";
import { NoiseQueryPact, type NoiseQuery } from "./pacts";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const DEFAULT_RADIUS_M = 500;
const MAX_RADIUS_M = 2000;

export type NoiseAssessment = "very quiet" | "quiet" | "moderate" | "noisy" | "very noisy";

export interface QuietZone {
    lat: number;
    lng: number;
    type: string;
    name?: string;
    area?: string;
}

export interface NoiseSource {
    lat: number;
    lng: number;
    type: string;
    name?: string;
    subtype: string;
}

export interface NoiseProfile {
    quietZoneCount: number;
    noiseSourceCount: number;
    assessment: NoiseAssessment;
}

export interface NoiseResult {
    center: { lat: number; lng: number };
    radiusM: number;
    quietZones: QuietZone[];
    noiseSources: NoiseSource[];
    profile: NoiseProfile;
}

function clampRadius(parsed: number): number {
    return Math.min(Math.max(parsed || DEFAULT_RADIUS_M, 50), MAX_RADIUS_M);
}

function assessNoise(quietCount: number, noiseCount: number): NoiseAssessment {
    if (noiseCount === 0) return "very quiet";
    const ratio = quietCount / noiseCount;
    if (ratio > 3) return "very quiet";
    if (ratio > 1.5) return "quiet";
    if (ratio > 0.7) return "moderate";
    if (ratio > 0.3) return "noisy";
    return "very noisy";
}

function buildOverpassQuery(lat: number, lng: number, radiusM: number): string {
    return `[out:json][timeout:30];
(
  node["leisure"="park"](around:${radiusM},${lat},${lng});
  way["leisure"="park"](around:${radiusM},${lat},${lng});
  node["leisure"="garden"](around:${radiusM},${lat},${lng});
  way["leisure"="garden"](around:${radiusM},${lat},${lng});
  node["landuse"="forest"](around:${radiusM},${lat},${lng});
  way["landuse"="forest"](around:${radiusM},${lat},${lng});
  node["natural"="wood"](around:${radiusM},${lat},${lng});
  way["natural"="wood"](around:${radiusM},${lat},${lng});
  node["leisure"="nature_reserve"](around:${radiusM},${lat},${lng});
  way["leisure"="nature_reserve"](around:${radiusM},${lat},${lng});
  node["highway"="motorway"](around:${radiusM},${lat},${lng});
  way["highway"="motorway"](around:${radiusM},${lat},${lng});
  node["highway"="trunk"](around:${radiusM},${lat},${lng});
  way["highway"="trunk"](around:${radiusM},${lat},${lng});
  node["highway"="primary"](around:${radiusM},${lat},${lng});
  way["highway"="primary"](around:${radiusM},${lat},${lng});
  node["railway"="rail"](around:${radiusM},${lat},${lng});
  way["railway"="rail"](around:${radiusM},${lat},${lng});
  node["aeroway"="aerodrome"](around:${radiusM},${lat},${lng});
  way["aeroway"="aerodrome"](around:${radiusM},${lat},${lng});
  node["aeroway"="runway"](around:${radiusM},${lat},${lng});
  way["aeroway"="runway"](around:${radiusM},${lat},${lng});
);
out center;`;
}

const QUIET_TAGS: Record<string, string> = {
    "park": "leisure",
    "garden": "leisure",
    "forest": "landuse",
    "wood": "natural",
    "nature_reserve": "leisure",
};

const NOISE_TAGS: Record<string, string> = {
    "motorway": "highway",
    "trunk": "highway",
    "primary": "highway",
    "rail": "railway",
    "aerodrome": "aeroway",
    "runway": "aeroway",
};

interface OverpassElement {
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
}

function classifyElement(tags: Record<string, string>): { isQuiet: boolean; type: string; subtype: string } | null {
    for (const [value, key] of Object.entries(QUIET_TAGS)) {
        if (tags[key] === value) {
            return { isQuiet: true, type: key, subtype: value };
        }
    }
    for (const [value, key] of Object.entries(NOISE_TAGS)) {
        if (tags[key] === value) {
            return { isQuiet: false, type: key, subtype: value };
        }
    }
    return null;
}

export class NoiseRetriever extends Dog<NoiseResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return NoiseRetriever.name;
    }

    get description(): string {
        return "Analyzes nearby quiet zones and noise sources via the Overpass/OpenStreetMap API.";
    }

    get icon(): string | undefined {
        return getBaseDogIcon(NoiseRetriever.name);
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [NoiseQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<NoiseResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(NoiseQueryPact, d));
        const query = (queryDog?.collected as NoiseQuery | undefined) ?? ({} as NoiseQuery);

        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampRadius(parseFloat(query.radius ?? ""));

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error("NoiseRetriever: Missing required query params (lat, lng)");
        }

        const key = `noise:${lat}:${lng}:${radiusM}`;

        const fetchNoise = async (): Promise<NoiseResult> => {
            const overpassQuery = buildOverpassQuery(lat, lng, radiusM);
            const userAgent =
                process.env.OVERPASS_USER_AGENT ??
                "dataDogs/NoiseRetriever (contact: set OVERPASS_USER_AGENT)";

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 35000);

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

            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(
                    `NoiseRetriever: Overpass HTTP ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ""}`
                );
            }

            const json = await res.json() as { elements?: OverpassElement[] };
            const rawElements = json.elements ?? [];

            const seen = new Set<string>();
            const quietZones: QuietZone[] = [];
            const noiseSources: NoiseSource[] = [];

            for (const el of rawElements) {
                if (!el.tags || Object.keys(el.tags).length === 0) continue;

                const dedupKey = `${el.type}/${el.id}`;
                if (seen.has(dedupKey)) continue;
                seen.add(dedupKey);

                const classification = classifyElement(el.tags);
                if (!classification) continue;

                const elLat = el.lat ?? el.center?.lat;
                const elLng = el.lon ?? el.center?.lon;
                if (elLat == null || elLng == null) continue;

                if (classification.isQuiet) {
                    quietZones.push({
                        lat: elLat,
                        lng: elLng,
                        type: classification.subtype,
                        name: el.tags["name"],
                        area: el.tags["area"],
                    });
                } else {
                    noiseSources.push({
                        lat: elLat,
                        lng: elLng,
                        type: classification.type,
                        name: el.tags["name"],
                        subtype: classification.subtype,
                    });
                }
            }

            const assessment = assessNoise(quietZones.length, noiseSources.length);

            return {
                center: { lat, lng },
                radiusM,
                quietZones,
                noiseSources,
                profile: {
                    quietZoneCount: quietZones.length,
                    noiseSourceCount: noiseSources.length,
                    assessment,
                },
            };
        };

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 60 * 60_000, fetchNoise);
        }
        return fetchNoise();
    };
}
