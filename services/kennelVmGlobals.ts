import type { SerializedDogVmGlobalsSupplier } from "@datadogs/core";
import {
    OsmLandmarksRetriever,
    NearbyLandmarksPact,
    DEFAULT_LANDMARKS_FACETS,
    LandmarksOverpassFacet,
} from "@datadogs/dogs-geo";

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
