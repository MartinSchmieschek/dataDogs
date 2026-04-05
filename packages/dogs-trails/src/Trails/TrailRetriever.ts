import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@datadogs/core";
import { getBaseDogIcon } from "@datadogs/core";
import { TrailQueryPact, type TrailQuery } from "./pacts";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const DEFAULT_RADIUS_M = 3000;
const MAX_RADIUS_M = 15000;

export type TrailType = "hiking" | "bicycle" | "both";

export interface TrailElement {
    id: number;
    type: "way" | "relation";
    name?: string;
    trailType: "hiking" | "bicycle";
    distance?: string;
    surface?: string;
    coordinates: Array<{ lat: number; lon: number }>;
    tags: Record<string, string>;
}

export interface TrailResult {
    center: { lat: number; lng: number };
    radiusM: number;
    trailType: TrailType;
    trails: TrailElement[];
}

function clampRadius(parsed: number): number {
    if (isNaN(parsed) || parsed < 1) return DEFAULT_RADIUS_M;
    return Math.min(Math.round(parsed), MAX_RADIUS_M);
}

function parseTrailType(raw?: string): TrailType {
    if (!raw) return "both";
    const v = raw.toLowerCase();
    if (v === "hiking" || v === "walking" || v === "foot") return "hiking";
    if (v === "bicycle" || v === "cycling" || v === "bike") return "bicycle";
    return "both";
}

function buildOverpassQuery(lat: number, lng: number, radiusM: number, trailType: TrailType): string {
    const lines: string[] = [];

    if (trailType === "hiking" || trailType === "both") {
        lines.push(`  relation["route"="hiking"](around:${radiusM},${lat},${lng});`);
        lines.push(`  relation["route"="foot"](around:${radiusM},${lat},${lng});`);
        lines.push(`  way["highway"="path"]["foot"!="no"](around:${radiusM},${lat},${lng});`);
        lines.push(`  way["highway"="footway"](around:${radiusM},${lat},${lng});`);
    }

    if (trailType === "bicycle" || trailType === "both") {
        lines.push(`  relation["route"="bicycle"](around:${radiusM},${lat},${lng});`);
        lines.push(`  way["highway"="cycleway"](around:${radiusM},${lat},${lng});`);
        lines.push(`  way["highway"="path"]["bicycle"="yes"](around:${radiusM},${lat},${lng});`);
        lines.push(`  way["highway"="track"]["bicycle"="yes"](around:${radiusM},${lat},${lng});`);
    }

    return `[out:json][timeout:30];
(
${lines.join("\n")}
);
out body;
>;
out skel qt;`;
}

interface OverpassElement {
    type: string;
    id: number;
    lat?: number;
    lon?: number;
    tags?: Record<string, string>;
    members?: Array<{ type: string; ref: number; role: string }>;
    nodes?: number[];
}

function classifyTrailType(tags: Record<string, string>): "hiking" | "bicycle" {
    const route = tags["route"] ?? "";
    if (route === "bicycle") return "bicycle";
    if (route === "hiking" || route === "foot") return "hiking";

    const highway = tags["highway"] ?? "";
    if (highway === "cycleway") return "bicycle";
    if (tags["bicycle"] === "yes" && highway !== "footway") return "bicycle";

    return "hiking";
}

export class TrailRetriever extends Dog<TrailResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    get name(): string {
        return TrailRetriever.name;
    }

    get description(): string {
        return "Finds nearby hiking trails and cycling routes via the Overpass/OpenStreetMap API.";
    }

    get icon(): string | undefined {
        return getBaseDogIcon(TrailRetriever.name);
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [TrailQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<TrailResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(TrailQueryPact, d));
        const query = (queryDog?.collected as TrailQuery | undefined) ?? ({} as TrailQuery);

        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampRadius(parseFloat(query.radius ?? ""));
        const trailType = parseTrailType(query.type);

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error("TrailRetriever: Missing required query params (lat, lng)");
        }

        const key = `trails:${lat}:${lng}:${radiusM}:${trailType}`;

        const fetchTrails = async (): Promise<TrailResult> => {
            const overpassQuery = buildOverpassQuery(lat, lng, radiusM, trailType);
            const userAgent =
                process.env.OVERPASS_USER_AGENT ??
                "jsonAggregator/TrailRetriever (contact: set OVERPASS_USER_AGENT)";

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
                    `TrailRetriever: Overpass HTTP ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ""}`
                );
            }

            const json = await res.json() as { elements?: OverpassElement[] };
            const rawElements = json.elements ?? [];

            // Build a node lookup for resolving way/relation coordinates
            const nodeMap = new Map<number, { lat: number; lon: number }>();
            for (const el of rawElements) {
                if (el.type === "node" && el.lat != null && el.lon != null) {
                    nodeMap.set(el.id, { lat: el.lat, lon: el.lon });
                }
            }

            // Extract ways and relations with tags (actual trails)
            const seen = new Set<string>();
            const trails: TrailElement[] = [];

            for (const el of rawElements) {
                if (el.type !== "way" && el.type !== "relation") continue;
                if (!el.tags || Object.keys(el.tags).length === 0) continue;

                const dedupKey = `${el.type}/${el.id}`;
                if (seen.has(dedupKey)) continue;
                seen.add(dedupKey);

                // Resolve coordinates for ways
                const coordinates: Array<{ lat: number; lon: number }> = [];
                if (el.type === "way" && el.nodes) {
                    for (const nodeId of el.nodes) {
                        const node = nodeMap.get(nodeId);
                        if (node) coordinates.push(node);
                    }
                }

                const tags = el.tags;
                trails.push({
                    id: el.id,
                    type: el.type as "way" | "relation",
                    name: tags["name"],
                    trailType: classifyTrailType(tags),
                    distance: tags["distance"],
                    surface: tags["surface"],
                    coordinates,
                    tags,
                });
            }

            return { center: { lat, lng }, radiusM, trailType, trails };
        };

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 6 * 60 * 60_000, fetchTrails);
        }
        return fetchTrails();
    };
}
