/**
 * =========================================================================
 *  OSM PACTS — eldritch contracts with the cartographic void
 * =========================================================================
 *
 *  Arr, these be the pacts that anchor our vessel to the OpenStreetMap
 *  abyss. From brooding gulfs are we beheld, by that which bears no
 *  name — and so we sign these typed accords, bindin' our crew to
 *  the query providers that dwell in the deep.
 *
 *  Carrion hordes trill their profane accord with eldritch plans.
 * =========================================================================
 */

import { createPact } from "@datadogs/core";
import type { LandmarksOverpassFacet } from "./overpassLandmarks";

// Arr, re-export the facet types — let all who sail these waters know the void's taxonomy
export {
    DEFAULT_LANDMARKS_FACETS,
    LandmarksOverpassFacet,
    /** @deprecated Arr, this name be swallowed by the abyss — use LandmarksOverpassFacet */
    LandmarksPreset,
    OsmLandmarkElementType,
} from "./overpassLandmarks";

/**
 * Required query input for OsmLandmarksRetriever — the coordinates and
 * parameters we must whisper to the void (lowercase keys from QueryRetriever/Mimic).
 * Not to be confused with BloodhoundIsochroneInput, matey — that be a different horror.
 */
export interface OsmLandmarksQueryInput {
    /** Arr, the latitude to search around — the heart of the void from which we dredge landmarks */
    lat: string;
    /** The longitude, matey — the east-west bearing into the eldritch deep */
    lng: string;
    /** Search radius in meters — how far into the abyss we dare cast our net, arr */
    radius?: string;
    /** Which OSM facets to query; omit for Tourism + Historic (see DEFAULT_LANDMARKS_FACETS). To cosmic madness laws submit. */
    preset?: LandmarksOverpassFacet[];
}

/** @deprecated Arr, use OsmLandmarksQueryInput — this alias be claimed by the deep */
export type NearbyLandmarksQuery = OsmLandmarksQueryInput;

/** The pact that binds the landmarks retriever to its query source — an anchor in the abyss */
export const NearbyLandmarksPact = createPact<OsmLandmarksQueryInput>(
    "NearbyLandmarksQueryProvider",
    { fromSourceType: "OsmLandmarksQueryInput" }
);
