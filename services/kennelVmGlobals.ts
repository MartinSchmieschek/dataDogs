import type { SerializedDogVmGlobalsSupplier } from "datadogs";
import { OsmLandmarksRetriever } from "../dogs/OpenStreetMap/OsmLandmarksRetriever";
import { NearbyLandmarksPact } from "../dogs/OpenStreetMap/pacts";
import {
    DEFAULT_LANDMARKS_FACETS,
    LandmarksOverpassFacet,
} from "../dogs/OpenStreetMap/overpassLandmarks";

const nearbyLandmarksPactName = new NearbyLandmarksPact().name;

/**
 * VM-Globals für SerializedDog/Mimic — gehört zur App, nicht zu datadogs/core.
 */
export const kennelVmGlobalsSuppliers: SerializedDogVmGlobalsSupplier[] = [
    (ctx, dog, sourceDogs) => {
        const fromGetter = (dog as { imitatesName?: string }).imitatesName;
        const fromConfig = (dog as { instanceConfig?: { imitates?: string } }).instanceConfig?.imitates;
        const imitates = fromGetter ?? fromConfig;
        const isLandmarksMimic =
            typeof imitates === 'string' &&
            imitates.toLowerCase() === nearbyLandmarksPactName.toLowerCase();
        const parentHasLandmarksRetriever =
            sourceDogs?.some((d) => d.name === OsmLandmarksRetriever.name) ?? false;
        if (isLandmarksMimic || parentHasLandmarksRetriever) {
            ctx.LandmarksOverpassFacet = LandmarksOverpassFacet;
            ctx.DEFAULT_LANDMARKS_FACETS = DEFAULT_LANDMARKS_FACETS;
        }
    },
];
