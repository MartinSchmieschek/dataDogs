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
