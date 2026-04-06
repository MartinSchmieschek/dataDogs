import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@datadogs/core";
import { getBaseDogIcon } from "@datadogs/core";
import { PlaygroundQueryPact, type PlaygroundQuery } from "./pacts";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const DEFAULT_RADIUS_M = 500;
const MAX_RADIUS_M = 3000;

export type PlaygroundPlaceType = "playground" | "sports_centre" | "fitness" | "dog_park" | "pitch" | "pool";

export interface PlaygroundPlace {
    lat: number;
    lng: number;
    type: PlaygroundPlaceType;
    name?: string;
    sport?: string;
    access?: string;
    tags: Record<string, string>;
}

export interface PlaygroundResult {
    center: { lat: number; lng: number };
    radiusM: number;
    places: PlaygroundPlace[];
    counts: {
        playground: number;
        sportsCentre: number;
        fitness: number;
        dogPark: number;
        pitch: number;
        pool: number;
        total: number;
    };
}

interface OverpassElement {
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
}

function classifyPlaceType(tags: Record<string, string>): PlaygroundPlaceType {
    const leisure = tags["leisure"] ?? "";
    if (leisure === "playground") return "playground";
    if (leisure === "sports_centre") return "sports_centre";
    if (leisure === "fitness_station") return "fitness";
    if (leisure === "dog_park") return "dog_park";
    if (leisure === "pitch") return "pitch";
    if (leisure === "swimming_pool") return "pool";
    return "playground";
}

export class PlaygroundRetriever extends Dog<PlaygroundResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return PlaygroundRetriever.name;
    }

    get description(): string {
        return "Finds nearby playgrounds, sports facilities, dog parks and swimming pools via the Overpass/OpenStreetMap API.";
    }

    get icon(): string | undefined {
        return getBaseDogIcon(PlaygroundRetriever.name);
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [PlaygroundQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<PlaygroundResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(PlaygroundQueryPact, d));
        const query = (queryDog?.collected as PlaygroundQuery | undefined) ?? ({} as PlaygroundQuery);

        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const parsed = parseFloat(query.radius ?? "");
        const radiusM = Math.min(Math.max(isNaN(parsed) ? DEFAULT_RADIUS_M : parsed, 50), MAX_RADIUS_M);

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error("PlaygroundRetriever: Missing required query params (lat, lng)");
        }

        const key = `playground:${lat}:${lng}:${radiusM}`;

        const fetchPlaygrounds = async (): Promise<PlaygroundResult> => {
            const overpassQuery = `[out:json][timeout:25];(node["leisure"="playground"](around:${radiusM},${lat},${lng});node["leisure"="sports_centre"](around:${radiusM},${lat},${lng});node["leisure"="fitness_station"](around:${radiusM},${lat},${lng});node["leisure"="dog_park"](around:${radiusM},${lat},${lng});node["leisure"="pitch"](around:${radiusM},${lat},${lng});node["leisure"="swimming_pool"](around:${radiusM},${lat},${lng});way["leisure"="playground"](around:${radiusM},${lat},${lng});way["leisure"="sports_centre"](around:${radiusM},${lat},${lng});way["leisure"="fitness_station"](around:${radiusM},${lat},${lng});way["leisure"="dog_park"](around:${radiusM},${lat},${lng});way["leisure"="pitch"](around:${radiusM},${lat},${lng});way["leisure"="swimming_pool"](around:${radiusM},${lat},${lng}););out center;`;

            const userAgent =
                process.env.OVERPASS_USER_AGENT ??
                "jsonAggregator/PlaygroundRetriever (contact: set OVERPASS_USER_AGENT)";

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 30000);

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
                    `PlaygroundRetriever: Overpass HTTP ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ""}`
                );
            }

            const json = await res.json() as { elements?: OverpassElement[] };
            const rawElements = json.elements ?? [];

            const seen = new Set<string>();
            const places: PlaygroundPlace[] = [];

            for (const el of rawElements) {
                if (!el.tags || Object.keys(el.tags).length === 0) continue;

                const dedupKey = `${el.type}/${el.id}`;
                if (seen.has(dedupKey)) continue;
                seen.add(dedupKey);

                const elLat = el.lat ?? el.center?.lat;
                const elLng = el.lon ?? el.center?.lon;
                if (elLat == null || elLng == null) continue;

                const tags = el.tags;
                places.push({
                    lat: elLat,
                    lng: elLng,
                    type: classifyPlaceType(tags),
                    name: tags["name"],
                    sport: tags["sport"],
                    access: tags["access"],
                    tags,
                });
            }

            const counts = {
                playground: places.filter(p => p.type === "playground").length,
                sportsCentre: places.filter(p => p.type === "sports_centre").length,
                fitness: places.filter(p => p.type === "fitness").length,
                dogPark: places.filter(p => p.type === "dog_park").length,
                pitch: places.filter(p => p.type === "pitch").length,
                pool: places.filter(p => p.type === "pool").length,
                total: places.length,
            };

            return { center: { lat, lng }, radiusM, places, counts };
        };

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 30 * 60_000, fetchPlaygrounds);
        }
        return fetchPlaygrounds();
    };
}
