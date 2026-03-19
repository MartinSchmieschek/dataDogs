import { createPact } from "datadogs";

/**
 * Pflicht-Query für OsmLandmarksRetriever (QueryRetriever/Mimic: lowercase-Keys).
 * Eigenständiger Typname — nicht mit BloodhoundIsochroneInput verwechseln.
 */
export interface OsmLandmarksQueryInput {
    lat: string;
    lng: string;
    radius?: string;
    preset?: string;
}

/** @deprecated Alias — nutze OsmLandmarksQueryInput */
export type NearbyLandmarksQuery = OsmLandmarksQueryInput;

export const NearbyLandmarksPact = createPact<OsmLandmarksQueryInput>(
    "NearbyLandmarksQueryProvider",
    { fromSourceType: "OsmLandmarksQueryInput" }
);
