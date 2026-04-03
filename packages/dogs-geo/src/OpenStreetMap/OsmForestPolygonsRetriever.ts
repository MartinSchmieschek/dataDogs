/**
 * OSM forest / landuse / natural area polygons → GeoJSON (full geometry).
 */

import { Dog, IHuntingDog, IHuntingSeason, getBaseDogIcon } from "@datadogs/core";
import { OsmForestGeometryPact, type OsmForestGeometryQueryInput } from "./osmGeometryPacts";
import { parseOsmLanduseList, parseOsmNaturalList, OsmLanduseValue, OsmNaturalValue } from "./osmGeometryEnums";
import {
    buildForestAreaOverpassQuery,
    circleToBoundingBox,
    clampGeometryRadiusM,
    fetchOverpassGeometry,
    overpassJsonToGeoJson,
    type BoundingBox,
} from "./overpassGeometryCore";
import type { FeatureCollection, GeometryObject } from "geojson";

export interface OsmForestPolygonsResult {
    center: { lat: number; lng: number };
    radiusM: number;
    bbox: BoundingBox;
    landuse: OsmLanduseValue[];
    natural: OsmNaturalValue[];
    geojson: FeatureCollection<GeometryObject>;
}

export class OsmForestPolygonsRetriever extends Dog<OsmForestPolygonsResult> {
    get name(): string {
        return OsmForestPolygonsRetriever.name;
    }

    get icon(): string | undefined {
        return getBaseDogIcon(OsmForestPolygonsRetriever.name);
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [OsmForestGeometryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<OsmForestPolygonsResult> => {
        const queryDog = season.exhausted.find((d) => this.matchesParent(OsmForestGeometryPact, d));
        const query =
            (queryDog?.collected as OsmForestGeometryQueryInput | undefined) ??
            ({} as OsmForestGeometryQueryInput);

        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampGeometryRadiusM(parseFloat(query.radius ?? ""));
        const landuse = parseOsmLanduseList(query.landuse);
        const natural = parseOsmNaturalList(query.natural);

        if (Number.isNaN(lat) || Number.isNaN(lng)) {
            throw new Error("OsmForestPolygonsRetriever: Missing required query params (lat, lng)");
        }

        const bbox = circleToBoundingBox(lat, lng, radiusM);
        const overpassQuery = buildForestAreaOverpassQuery(bbox, landuse, natural, 180);
        const osmJson = await fetchOverpassGeometry(overpassQuery, 300000);
        const geojson = overpassJsonToGeoJson(osmJson);

        return {
            center: { lat, lng },
            radiusM,
            bbox,
            landuse,
            natural,
            geojson,
        };
    };
}
