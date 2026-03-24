import { createPact } from "datadogs";
import type { LandmarksOverpassFacet } from "./overpassLandmarks";

export {
    DEFAULT_LANDMARKS_FACETS,
    LandmarksOverpassFacet,
    /** @deprecated */
    LandmarksPreset,
    OsmLandmarkElementType,
} from "./overpassLandmarks";

/**
 * Pflicht-Query für OsmLandmarksRetriever (QueryRetriever/Mimic: lowercase-Keys).
 * Eigenständiger Typname — nicht mit BloodhoundIsochroneInput verwechseln.
 */
export interface OsmLandmarksQueryInput {
    lat: string;
    lng: string;
    radius?: string;
    /** Welche OSM-Facetten abfragen; weglassen = Tourism + Historic (siehe DEFAULT_LANDMARKS_FACETS). */
    preset?: LandmarksOverpassFacet[];
}

/** @deprecated Alias — nutze OsmLandmarksQueryInput */
export type NearbyLandmarksQuery = OsmLandmarksQueryInput;

export const NearbyLandmarksPact = createPact<OsmLandmarksQueryInput>(
    "NearbyLandmarksQueryProvider",
    { fromSourceType: "OsmLandmarksQueryInput" }
);
