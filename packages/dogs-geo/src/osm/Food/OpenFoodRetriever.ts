import { IHuntingSeason } from "@datadogs/core";
import { OsmFeatureRetriever, type OsmQueryBase } from "../base/OsmFeatureRetriever";
import {
    type OverpassRawElement,
    overpassElementRepresentativePoint,
} from "../base/overpassMirrorChain";
import { OpenFoodQueryPact, type OpenFoodQuery } from "./pacts";

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

export class OpenFoodRetriever extends OsmFeatureRetriever<OpenFoodResult, typeof OpenFoodQueryPact> {
    protected readonly layer = "food";
    protected readonly defaultRadiusM = 500;
    protected readonly maxRadiusM = 3000;
    protected readonly queryPactClass = OpenFoodQueryPact;

    get name(): string {
        return OpenFoodRetriever.name;
    }

    get description(): string {
        return "Finds nearby restaurants, cafes, bakeries and more via the Overpass/OpenStreetMap API.";
    }

    protected parseQuery(season: IHuntingSeason): OsmQueryBase {
        const queryDog = season.exhausted.find((d) => this.matchesParent(OpenFoodQueryPact, d));
        const query = (queryDog?.collected as OpenFoodQuery | undefined) ?? ({} as OpenFoodQuery);
        const cuisine = query.cuisine?.trim() || undefined;
        const extras: Record<string, string> = {};
        if (cuisine) extras["cuisine"] = cuisine;
        return {
            lat: parseFloat(query.lat),
            lng: parseFloat(query.lng),
            radiusM: this.clampRadius(parseFloat(query.radius ?? "")),
            extras,
        };
    }

    protected buildOverpassBody(q: OsmQueryBase): string {
        const { lat, lng, radiusM } = q;
        const cuisine = q.extras?.["cuisine"];
        const cuisineFilter = cuisine ? `["cuisine"~"${cuisine}",i]` : "";
        const lines: string[] = [];
        for (const amenity of AMENITY_TYPES) {
            lines.push(`  node["amenity"="${amenity}"]${cuisineFilter}(around:${radiusM},${lat},${lng});`);
            lines.push(`  way["amenity"="${amenity}"]${cuisineFilter}(around:${radiusM},${lat},${lng});`);
        }
        return lines.join("\n");
    }

    protected mapElements(elements: OverpassRawElement[], q: OsmQueryBase): OpenFoodResult {
        const seen = new Set<string>();
        const places: FoodPlace[] = [];

        for (const el of elements) {
            if (!el.tags || Object.keys(el.tags).length === 0) continue;
            const dedupKey = `${el.type}/${el.id}`;
            if (seen.has(dedupKey)) continue;
            seen.add(dedupKey);

            const amenity = el.tags["amenity"] as FoodPlaceType | undefined;
            if (!amenity || !AMENITY_TYPES.includes(amenity)) continue;

            const point = overpassElementRepresentativePoint(el);
            if (!point) continue;

            places.push({
                lat: point.lat,
                lng: point.lng,
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
            restaurant: places.filter((p) => p.type === "restaurant").length,
            cafe: places.filter((p) => p.type === "cafe").length,
            fastFood: places.filter((p) => p.type === "fast_food").length,
            bakery: places.filter((p) => p.type === "bakery").length,
            bar: places.filter((p) => p.type === "bar").length,
            pub: places.filter((p) => p.type === "pub").length,
            iceCream: places.filter((p) => p.type === "ice_cream").length,
            biergarten: places.filter((p) => p.type === "biergarten").length,
            total: places.length,
        };

        return {
            center: { lat: q.lat, lng: q.lng },
            radiusM: q.radiusM,
            places,
            counts,
        };
    }
}
