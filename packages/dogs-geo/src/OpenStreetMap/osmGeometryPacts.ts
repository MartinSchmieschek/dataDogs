/**
 * Pacts for OSM circle-based geometry queries — lat, lng, radius (meters) only.
 */

import { createPact } from "@datadogs/core";

/** Query input for forest / area polygon geometry */
export interface OsmForestGeometryQueryInput {
    lat: string;
    lng: string;
    radius?: string;
    /** Landuse enum values — JSON array or string; defaults to forest */
    landuse?: unknown;
    /** Natural enum values — JSON array or string; defaults to wood */
    natural?: unknown;
}

export const OsmForestGeometryPact = createPact<OsmForestGeometryQueryInput>(
    "OsmForestGeometryQueryProvider",
    { fromSourceType: "OsmForestGeometryQueryInput" }
);

/** Query input for street line geometry */
export interface OsmStreetsGeometryQueryInput {
    lat: string;
    lng: string;
    radius?: string;
    /** Highway enum values — JSON array or string */
    highway?: unknown;
    /** When set to `major_only`, expands to motorway/trunk/primary/secondary/tertiary */
    preset?: string;
}

export const OsmStreetsGeometryPact = createPact<OsmStreetsGeometryQueryInput>(
    "OsmStreetsGeometryQueryProvider",
    { fromSourceType: "OsmStreetsGeometryQueryInput" }
);

/** Query input for building polygons */
export interface OsmBuildingsGeometryQueryInput {
    lat: string;
    lng: string;
    radius?: string;
    /**
     * Optional list of `building=*` values to restrict to (e.g. ["residential", "industrial"]).
     * Omit to fetch all buildings (any `building=*` tag).
     */
    building?: unknown;
}

export const OsmBuildingsGeometryPact = createPact<OsmBuildingsGeometryQueryInput>(
    "OsmBuildingsGeometryQueryProvider",
    { fromSourceType: "OsmBuildingsGeometryQueryInput" }
);

/** Query input for railway line geometry */
export interface OsmRailsGeometryQueryInput {
    lat: string;
    lng: string;
    radius?: string;
    /** Railway enum values — JSON array or string; defaults to passenger transit */
    railway?: unknown;
}

export const OsmRailsGeometryPact = createPact<OsmRailsGeometryQueryInput>(
    "OsmRailsGeometryQueryProvider",
    { fromSourceType: "OsmRailsGeometryQueryInput" }
);

/**
 * Query input for landscape features — point trees, tree rows, walls/fences,
 * and vertical man-made structures (towers, masts). Caller picks subsets via
 * the four optional arrays; omit a field to take its default.
 */
export interface OsmLandscapeFeaturesQueryInput {
    lat: string;
    lng: string;
    radius?: string;
    /** `natural=tree | tree_row` (point + line vegetation, complements polygon vegetation) */
    nature?: unknown;
    /** `barrier=wall | fence | hedge | …` (linear obstructions) */
    barrier?: unknown;
    /** `man_made=tower | mast | chimney | silo | …` (vertical structures) */
    manMade?: unknown;
}

export const OsmLandscapeFeaturesPact = createPact<OsmLandscapeFeaturesQueryInput>(
    "OsmLandscapeFeaturesQueryProvider",
    { fromSourceType: "OsmLandscapeFeaturesQueryInput" }
);
