import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@datadogs/core";
import { getBaseDogIcon } from "@datadogs/core";
import { DrinkingWaterQueryPact, type DrinkingWaterQuery } from "./pacts";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const DEFAULT_RADIUS_M = 500;
const MAX_RADIUS_M = 3000;

export type DrinkingWaterFacilityType = "drinking_water" | "toilet" | "water_point" | "water_tap";

export interface DrinkingWaterFacility {
    lat: number;
    lng: number;
    type: DrinkingWaterFacilityType;
    name?: string;
    fee?: string;
    wheelchair?: string;
    opening_hours?: string;
    tags: Record<string, string>;
}

export interface DrinkingWaterResult {
    center: { lat: number; lng: number };
    radiusM: number;
    facilities: DrinkingWaterFacility[];
    counts: {
        drinkingWater: number;
        toilet: number;
        waterPoint: number;
        waterTap: number;
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

function classifyFacilityType(tags: Record<string, string>): DrinkingWaterFacilityType {
    if (tags["man_made"] === "water_tap") return "water_tap";
    const amenity = tags["amenity"] ?? "";
    if (amenity === "drinking_water") return "drinking_water";
    if (amenity === "toilets") return "toilet";
    if (amenity === "water_point") return "water_point";
    return "drinking_water";
}

export class DrinkingWaterRetriever extends Dog<DrinkingWaterResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return DrinkingWaterRetriever.name;
    }

    get description(): string {
        return "Finds nearby drinking water fountains, water points and public toilets via the Overpass/OpenStreetMap API.";
    }

    get icon(): string | undefined {
        return getBaseDogIcon(DrinkingWaterRetriever.name);
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [DrinkingWaterQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<DrinkingWaterResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(DrinkingWaterQueryPact, d));
        const query = (queryDog?.collected as DrinkingWaterQuery | undefined) ?? ({} as DrinkingWaterQuery);

        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const parsed = parseFloat(query.radius ?? "");
        const radiusM = Math.min(Math.max(isNaN(parsed) ? DEFAULT_RADIUS_M : parsed, 50), MAX_RADIUS_M);

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error("DrinkingWaterRetriever: Missing required query params (lat, lng)");
        }

        const key = `drinking-water:${lat}:${lng}:${radiusM}`;

        const fetchFacilities = async (): Promise<DrinkingWaterResult> => {
            const overpassQuery = `[out:json][timeout:25];(node["amenity"="drinking_water"](around:${radiusM},${lat},${lng});node["amenity"="toilets"](around:${radiusM},${lat},${lng});node["amenity"="water_point"](around:${radiusM},${lat},${lng});node["man_made"="water_tap"](around:${radiusM},${lat},${lng});way["amenity"="drinking_water"](around:${radiusM},${lat},${lng});way["amenity"="toilets"](around:${radiusM},${lat},${lng}););out center;`;

            const userAgent =
                process.env.OVERPASS_USER_AGENT ??
                "jsonAggregator/DrinkingWaterRetriever (contact: set OVERPASS_USER_AGENT)";

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
                    `DrinkingWaterRetriever: Overpass HTTP ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ""}`
                );
            }

            const json = await res.json() as { elements?: OverpassElement[] };
            const rawElements = json.elements ?? [];

            const seen = new Set<string>();
            const facilities: DrinkingWaterFacility[] = [];

            for (const el of rawElements) {
                if (!el.tags || Object.keys(el.tags).length === 0) continue;

                const dedupKey = `${el.type}/${el.id}`;
                if (seen.has(dedupKey)) continue;
                seen.add(dedupKey);

                const elLat = el.lat ?? el.center?.lat;
                const elLng = el.lon ?? el.center?.lon;
                if (elLat == null || elLng == null) continue;

                const tags = el.tags;
                facilities.push({
                    lat: elLat,
                    lng: elLng,
                    type: classifyFacilityType(tags),
                    name: tags["name"],
                    fee: tags["fee"],
                    wheelchair: tags["wheelchair"],
                    opening_hours: tags["opening_hours"],
                    tags,
                });
            }

            const counts = {
                drinkingWater: facilities.filter(f => f.type === "drinking_water").length,
                toilet: facilities.filter(f => f.type === "toilet").length,
                waterPoint: facilities.filter(f => f.type === "water_point").length,
                waterTap: facilities.filter(f => f.type === "water_tap").length,
                total: facilities.length,
            };

            return { center: { lat, lng }, radiusM, facilities, counts };
        };

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 60 * 60_000, fetchFacilities);
        }
        return fetchFacilities();
    };
}
