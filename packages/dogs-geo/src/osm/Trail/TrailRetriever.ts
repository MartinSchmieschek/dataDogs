import { IHuntingSeason } from "@datadogs/core";
import { OsmFeatureRetriever, type OsmQueryBase } from "../base/OsmFeatureRetriever";
import { type OverpassRawElement } from "../base/overpassMirrorChain";
import { TrailQueryPact, type TrailQuery } from "./pacts";

export type TrailType = "hiking" | "bicycle" | "both";
export type TrailPoint = { lat: number; lng: number };

export interface TrailElement {
    id: number;
    type: "way" | "relation";
    name?: string;
    trailType: "hiking" | "bicycle";
    distance?: string;
    surface?: string;
    /** Flat list: concatenation of all segments (for legacy consumers). */
    coordinates: TrailPoint[];
    /** Structured polylines: one entry per way (relations yield one per member). */
    segments: TrailPoint[][];
    tags: Record<string, string>;
}

/**
 * Das Trail-Result wird **mit** Helper-Funktionen zurueckgegeben. Die Basis-Klasse
 * ruft `postProcess()` auf jedem Rueckgabepfad auf — frisch, Area-Cache-Hit,
 * Key-Cache-Hit — damit der Consumer niemals ein nacktes Objekt sieht.
 */
export interface TrailResult {
    center: { lat: number; lng: number };
    radiusM: number;
    trailType: TrailType;
    trails: TrailElement[];
    toPolylines: (element: TrailElement) => TrailPoint[][];
    resolveAll: () => Array<{
        id: number;
        name?: string;
        trailType: "hiking" | "bicycle";
        segments: TrailPoint[][];
    }>;
    toGeoJSON: () => {
        type: "FeatureCollection";
        features: Array<{
            type: "Feature";
            geometry: { type: "LineString" | "MultiLineString"; coordinates: any };
            properties: Record<string, any>;
        }>;
    };
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

function parseTrailType(raw?: string): TrailType {
    if (!raw) return "both";
    const v = raw.toLowerCase();
    if (v === "hiking" || v === "walking" || v === "foot") return "hiking";
    if (v === "bicycle" || v === "cycling" || v === "bike") return "bicycle";
    return "both";
}

function makeToPolylines(): (element: TrailElement) => TrailPoint[][] {
    return (element: TrailElement): TrailPoint[][] => {
        if (!element) return [];
        if (Array.isArray(element.segments) && element.segments.length > 0) {
            return element.segments.filter((seg) => Array.isArray(seg) && seg.length >= 2);
        }
        if (Array.isArray(element.coordinates) && element.coordinates.length >= 2) {
            return [element.coordinates];
        }
        return [];
    };
}

function attachTrailHelpers(raw: Omit<TrailResult, "toPolylines" | "resolveAll" | "toGeoJSON">): TrailResult {
    const trails = raw.trails ?? [];
    const toPolylines = makeToPolylines();
    const resolveAll = () =>
        trails.map((t) => ({
            id: t.id,
            name: t.name,
            trailType: t.trailType,
            segments: toPolylines(t),
        }));
    const toGeoJSON = () => ({
        type: "FeatureCollection" as const,
        features: trails.map((t) => {
            const polylines = toPolylines(t);
            const isMulti = polylines.length !== 1;
            return {
                type: "Feature" as const,
                geometry: isMulti
                    ? {
                          type: "MultiLineString" as const,
                          coordinates: polylines.map((seg) => seg.map((p) => [p.lng, p.lat])),
                      }
                    : {
                          type: "LineString" as const,
                          coordinates: (polylines[0] ?? []).map((p) => [p.lng, p.lat]),
                      },
                properties: {
                    id: t.id,
                    name: t.name,
                    trailType: t.trailType,
                    surface: t.surface,
                    distance: t.distance,
                    osmType: t.type,
                },
            };
        }),
    });
    return { ...raw, toPolylines, resolveAll, toGeoJSON };
}

export class TrailRetriever extends OsmFeatureRetriever<TrailResult, typeof TrailQueryPact> {
    protected readonly layer = "trails";
    protected readonly defaultRadiusM = 3000;
    protected readonly maxRadiusM = 15000;
    protected readonly queryPactClass = TrailQueryPact;
    /** Trail nutzt `out geom;` damit Way-Geometrien inline kommen. */
    protected readonly outStatement = "out geom;";

    get name(): string {
        return TrailRetriever.name;
    }

    get description(): string {
        return "Finds nearby hiking trails and cycling routes via the Overpass/OpenStreetMap API.";
    }

    protected parseQuery(season: IHuntingSeason): OsmQueryBase {
        const queryDog = season.exhausted.find((d) => this.matchesParent(TrailQueryPact, d));
        const query = (queryDog?.collected as TrailQuery | undefined) ?? ({} as TrailQuery);
        const trailType = parseTrailType(query.type);
        return {
            lat: parseFloat(query.lat),
            lng: parseFloat(query.lng),
            radiusM: this.clampRadius(parseFloat(query.radius ?? "")),
            extras: { type: trailType },
        };
    }

    protected buildOverpassBody(q: OsmQueryBase): string {
        const { lat, lng, radiusM } = q;
        const trailType = (q.extras?.["type"] ?? "both") as TrailType;
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

        return lines.join("\n");
    }

    protected mapElements(elements: OverpassRawElement[], q: OsmQueryBase): TrailResult {
        const seen = new Set<string>();
        const trails: TrailElement[] = [];

        for (const el of elements) {
            if (el.type !== "way" && el.type !== "relation") continue;
            if (!el.tags || Object.keys(el.tags).length === 0) continue;
            const dedupKey = `${el.type}/${el.id}`;
            if (seen.has(dedupKey)) continue;
            seen.add(dedupKey);

            const segments: TrailPoint[][] = [];
            if (el.type === "way" && Array.isArray(el.geometry)) {
                if (el.geometry.length >= 2) {
                    segments.push(el.geometry.map(p => ({ lat: p.lat, lng: p.lon })));
                }
            } else if (el.type === "relation" && Array.isArray(el.members)) {
                for (const member of el.members) {
                    if (member.type !== "way" || !Array.isArray(member.geometry)) continue;
                    if (member.geometry.length >= 2) {
                        segments.push(member.geometry.map(p => ({ lat: p.lat, lng: p.lon })));
                    }
                }
            }

            const coordinates: TrailPoint[] = ([] as TrailPoint[]).concat(...segments);

            trails.push({
                id: el.id,
                type: el.type as "way" | "relation",
                name: el.tags["name"],
                trailType: classifyTrailType(el.tags),
                distance: el.tags["distance"],
                surface: el.tags["surface"],
                coordinates,
                segments,
                tags: el.tags,
            });
        }

        const trailType = (q.extras?.["type"] ?? "both") as TrailType;
        // Helper-Funktionen werden in postProcess angeheftet; hier liefern wir nur
        // die JSON-serialisierbaren Felder. Leere Helfer-Stubs erfuellen das Interface.
        return attachTrailHelpers({
            center: { lat: q.lat, lng: q.lng },
            radiusM: q.radiusM,
            trailType,
            trails,
        });
    }

    /**
     * Nach jedem Rueckgabepfad: Helper-Funktionen neu anheften. Bei frischem Fetch
     * sind sie schon drin (mapElements hat sie angehaengt) — wir checken das und
     * bauen sie sonst aus den trails-Arrays neu auf. Idempotent.
     */
    protected postProcess(result: TrailResult, _q: OsmQueryBase): TrailResult {
        if (typeof result.toPolylines === "function" && typeof result.resolveAll === "function") {
            return result;
        }
        return attachTrailHelpers({
            center: result.center,
            radiusM: result.radiusM,
            trailType: result.trailType,
            trails: result.trails ?? [],
        });
    }

    /**
     * Area-Cache-Hit: wir filtern Trails NICHT auf den kleineren Radius — der
     * Renderer kann ohnehin clippen und das Neu-Rendern einer etwas groesseren
     * Zone ist billiger als die Filterlogik.
     */
    protected filterAreaCacheHit(covering: TrailResult, _q: OsmQueryBase): TrailResult {
        return covering;
    }
}
