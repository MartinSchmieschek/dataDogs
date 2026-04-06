import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@datadogs/core";
import { getBaseDogIcon } from "@datadogs/core";
import { ParkingQueryPact, type ParkingQuery } from "./pacts";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const DEFAULT_RADIUS_M = 500;
const MAX_RADIUS_M = 3000;

export type ParkingSpotType = "car" | "bicycle" | "motorcycle" | "park_ride";

export interface ParkingSpot {
    lat: number;
    lng: number;
    type: ParkingSpotType;
    name?: string;
    capacity?: string;
    access?: string;
    fee?: string;
    tags: Record<string, string>;
}

export interface ParkingResult {
    center: { lat: number; lng: number };
    radiusM: number;
    spots: ParkingSpot[];
    counts: {
        car: number;
        bicycle: number;
        motorcycle: number;
        parkRide: number;
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

function classifyParkingType(tags: Record<string, string>): ParkingSpotType {
    if (tags["park_ride"] === "yes") return "park_ride";
    if (tags["amenity"] === "bicycle_parking") return "bicycle";
    if (tags["amenity"] === "motorcycle_parking") return "motorcycle";
    return "car";
}

export class ParkingRetriever extends Dog<ParkingResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return ParkingRetriever.name;
    }

    get description(): string {
        return "Finds nearby parking spots, bicycle parking, P+R and motorcycle parking via the Overpass/OpenStreetMap API.";
    }

    get icon(): string | undefined {
        return getBaseDogIcon(ParkingRetriever.name);
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [ParkingQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<ParkingResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(ParkingQueryPact, d));
        const query = (queryDog?.collected as ParkingQuery | undefined) ?? ({} as ParkingQuery);

        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const parsed = parseFloat(query.radius ?? "");
        const radiusM = Math.min(Math.max(isNaN(parsed) ? DEFAULT_RADIUS_M : parsed, 50), MAX_RADIUS_M);

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error("ParkingRetriever: Missing required query params (lat, lng)");
        }

        const key = `parking:${lat}:${lng}:${radiusM}`;

        const fetchParking = async (): Promise<ParkingResult> => {
            const overpassQuery = `[out:json][timeout:25];(node["amenity"="parking"](around:${radiusM},${lat},${lng});node["amenity"="bicycle_parking"](around:${radiusM},${lat},${lng});node["park_ride"="yes"](around:${radiusM},${lat},${lng});node["amenity"="motorcycle_parking"](around:${radiusM},${lat},${lng});way["amenity"="parking"](around:${radiusM},${lat},${lng}););out center;`;

            const userAgent =
                process.env.OVERPASS_USER_AGENT ??
                "jsonAggregator/ParkingRetriever (contact: set OVERPASS_USER_AGENT)";

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
                    `ParkingRetriever: Overpass HTTP ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ""}`
                );
            }

            const json = await res.json() as { elements?: OverpassElement[] };
            const rawElements = json.elements ?? [];

            const seen = new Set<string>();
            const spots: ParkingSpot[] = [];

            for (const el of rawElements) {
                if (!el.tags || Object.keys(el.tags).length === 0) continue;

                const dedupKey = `${el.type}/${el.id}`;
                if (seen.has(dedupKey)) continue;
                seen.add(dedupKey);

                const elLat = el.lat ?? el.center?.lat;
                const elLng = el.lon ?? el.center?.lon;
                if (elLat == null || elLng == null) continue;

                const tags = el.tags;
                spots.push({
                    lat: elLat,
                    lng: elLng,
                    type: classifyParkingType(tags),
                    name: tags["name"],
                    capacity: tags["capacity"],
                    access: tags["access"],
                    fee: tags["fee"],
                    tags,
                });
            }

            const counts = {
                car: spots.filter(s => s.type === "car").length,
                bicycle: spots.filter(s => s.type === "bicycle").length,
                motorcycle: spots.filter(s => s.type === "motorcycle").length,
                parkRide: spots.filter(s => s.type === "park_ride").length,
                total: spots.length,
            };

            return { center: { lat, lng }, radiusM, spots, counts };
        };

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 30 * 60_000, fetchParking);
        }
        return fetchParking();
    };
}
