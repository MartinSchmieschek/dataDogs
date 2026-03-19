import { createPact } from "datadogs";

/** Query-Parameter für OsmLandmarksRetriever (QueryRetriever liefert lowercase-Keys). */
export interface NearbyLandmarksQuery {
    lat: string;
    lng: string;
    radius?: string;
    preset?: string;
}

export const NearbyLandmarksPact = createPact<NearbyLandmarksQuery>(
    "NearbyLandmarksQueryProvider",
    { fromSourceType: "NearbyLandmarksQuery" }
);
