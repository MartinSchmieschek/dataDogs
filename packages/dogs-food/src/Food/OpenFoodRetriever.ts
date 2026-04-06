import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@datadogs/core";
import { getBaseDogIcon } from "@datadogs/core";
import { OpenFoodQueryPact, type OpenFoodQuery } from "./pacts";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const DEFAULT_RADIUS_M = 500;
const MAX_RADIUS_M = 3000;

export type FoodPlaceType =
    | "restaurant"
    | "cafe"
    | "fast_food"
    | "bakery"
    | "bar"
    | "pub"
    | "ice_cream"
    | "biergarten";

const AMENITY_TYPES: FoodPlaceType[] = [
    "restaurant",
    "cafe",
    "fast_food",
    "bakery",
    "bar",
    "pub",
    "ice_cream",
    "biergarten",
];

export interface FoodPlace {
    lat: number;
    lng: number;
    type: FoodPlaceType;
    name?: string;
    cuisine?: string;
    opening_hours?: string;
    phone?: string;
    website?: string;
    wheelchair?: string;
    outdoor_seating?: string;
    tags: Record<string, string>;
}

export interface OpenFoodCounts {
    restaurant: number;
    cafe: number;
    fastFood: number;
    bakery: number;
    bar: number;
    pub: number;
    iceCream: number;
    biergarten: number;
    total: number;
}

export interface OpenFoodResult {
    center: { lat: number; lng: number };
    radiusM: number;
    places: FoodPlace[];
    counts: OpenFoodCounts;
}

function clampRadius(parsed: number): number {
    return Math.min(Math.max(parsed || DEFAULT_RADIUS_M, 50), MAX_RADIUS_M);
}

function buildOverpassQuery(lat: number, lng: number, radiusM: number, cuisine?: string): string {
    const cuisineFilter = cuisine ? `["cuisine"~"${cuisine}",i]` : "";
    const lines: string[] = [];

    for (const amenity of AMENITY_TYPES) {
        lines.push(`  node["amenity"="${amenity}"]${cuisineFilter}(around:${radiusM},${lat},${lng});`);
        lines.push(`  way["amenity"="${amenity}"]${cuisineFilter}(around:${radiusM},${lat},${lng});`);
    }

    return `[out:json][timeout:30];
(
${lines.join("\n")}
);
out center;`;
}

interface OverpassElement {
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
}

export class OpenFoodRetriever extends Dog<OpenFoodResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return OpenFoodRetriever.name;
    }

    get description(): string {
        return "Finds nearby restaurants, cafes, bakeries and more via the Overpass/OpenStreetMap API.";
    }

    get icon(): string | undefined {
        return getBaseDogIcon(OpenFoodRetriever.name);
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [OpenFoodQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<OpenFoodResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(OpenFoodQueryPact, d));
        const query = (queryDog?.collected as OpenFoodQuery | undefined) ?? ({} as OpenFoodQuery);

        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampRadius(parseFloat(query.radius ?? ""));
        const cuisine = query.cuisine?.trim() || undefined;

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error("OpenFoodRetriever: Missing required query params (lat, lng)");
        }

        const key = `food:${lat}:${lng}:${radiusM}:${cuisine ?? "all"}`;

        const fetchFood = async (): Promise<OpenFoodResult> => {
            const overpassQuery = buildOverpassQuery(lat, lng, radiusM, cuisine);
            const userAgent =
                process.env.OVERPASS_USER_AGENT ??
                "dataDogs/OpenFoodRetriever (contact: set OVERPASS_USER_AGENT)";

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
                    `OpenFoodRetriever: Overpass HTTP ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ""}`
                );
            }

            const json = await res.json() as { elements?: OverpassElement[] };
            const rawElements = json.elements ?? [];

            const seen = new Set<string>();
            const places: FoodPlace[] = [];

            for (const el of rawElements) {
                if (!el.tags || Object.keys(el.tags).length === 0) continue;

                const dedupKey = `${el.type}/${el.id}`;
                if (seen.has(dedupKey)) continue;
                seen.add(dedupKey);

                const amenity = el.tags["amenity"] as FoodPlaceType | undefined;
                if (!amenity || !AMENITY_TYPES.includes(amenity)) continue;

                const elLat = el.lat ?? el.center?.lat;
                const elLng = el.lon ?? el.center?.lon;
                if (elLat == null || elLng == null) continue;

                places.push({
                    lat: elLat,
                    lng: elLng,
                    type: amenity,
                    name: el.tags["name"],
                    cuisine: el.tags["cuisine"],
                    opening_hours: el.tags["opening_hours"],
                    phone: el.tags["phone"],
                    website: el.tags["website"],
                    wheelchair: el.tags["wheelchair"],
                    outdoor_seating: el.tags["outdoor_seating"],
                    tags: el.tags,
                });
            }

            const counts: OpenFoodCounts = {
                restaurant: places.filter(p => p.type === "restaurant").length,
                cafe: places.filter(p => p.type === "cafe").length,
                fastFood: places.filter(p => p.type === "fast_food").length,
                bakery: places.filter(p => p.type === "bakery").length,
                bar: places.filter(p => p.type === "bar").length,
                pub: places.filter(p => p.type === "pub").length,
                iceCream: places.filter(p => p.type === "ice_cream").length,
                biergarten: places.filter(p => p.type === "biergarten").length,
                total: places.length,
            };

            return { center: { lat, lng }, radiusM, places, counts };
        };

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 30 * 60_000, fetchFood);
        }
        return fetchFood();
    };
}
