/**
 * OSM highway ways → GeoJSON line geometries.
 */

import { Dog, IHuntingDog, IHuntingSeason, getBaseDogIcon } from "@datadogs/core";
import { OsmStreetsGeometryPact, type OsmStreetsGeometryQueryInput } from "./osmGeometryPacts";
import { parseOsmHighwayList, type OsmHighwayValue } from "./osmGeometryEnums";
import {
    buildStreetsOverpassQuery,
    circleToBoundingBox,
    clampGeometryRadiusM,
    fetchOverpassGeometry,
    overpassJsonToGeoJson,
    type BoundingBox,
} from "./overpassGeometryCore";
import type { FeatureCollection, GeometryObject } from "geojson";

export interface OsmStreetsGeometryResult {
    center: { lat: number; lng: number };
    radiusM: number;
    bbox: BoundingBox;
    highway: OsmHighwayValue[];
    geojson: FeatureCollection<GeometryObject>;
}

export class OsmStreetsGeometryRetriever extends Dog<OsmStreetsGeometryResult> {
    get name(): string {
        return OsmStreetsGeometryRetriever.name;
    }

    get icon(): string | undefined {
        return getBaseDogIcon(OsmStreetsGeometryRetriever.name);
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [OsmStreetsGeometryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<OsmStreetsGeometryResult> => {
        const queryDog = season.exhausted.find((d) => this.matchesParent(OsmStreetsGeometryPact, d));
        const query =
            (queryDog?.collected as OsmStreetsGeometryQueryInput | undefined) ??
            ({} as OsmStreetsGeometryQueryInput);

        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampGeometryRadiusM(parseFloat(query.radius ?? ""));
        const highway = parseOsmHighwayList(query.highway, query.preset);

        if (Number.isNaN(lat) || Number.isNaN(lng)) {
            throw new Error("OsmStreetsGeometryRetriever: Missing required query params (lat, lng)");
        }

        const bbox = circleToBoundingBox(lat, lng, radiusM);
        const overpassQuery = buildStreetsOverpassQuery(bbox, highway, 120);
        const osmJson = await fetchOverpassGeometry(overpassQuery, 240000);
        const geojson = overpassJsonToGeoJson(osmJson);

        return {
            center: { lat, lng },
            radiusM,
            bbox,
            highway,
            geojson,
        };
    };
}
