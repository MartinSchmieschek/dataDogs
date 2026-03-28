import { Dog, IHuntingDog, IHuntingSeason } from "@datadogs/core";
import { NearbyLandmarksPact, type OsmLandmarksQueryInput } from "./pacts";
import {
    clampRadiusM,
    fetchNearbyLandmarks,
    parseLandmarkFacets,
    type OsmLandmarksResult,
} from "./overpassLandmarks";
import { getBaseDogIcon } from "@datadogs/core";

export class OsmLandmarksRetriever extends Dog<OsmLandmarksResult> {
    get name(): string {
        return OsmLandmarksRetriever.name;
    }

    get icon(): string | undefined {
        return getBaseDogIcon(OsmLandmarksRetriever.name);
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [NearbyLandmarksPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<OsmLandmarksResult> => {
        const queryDog = season.exhausted.find((d) => this.matchesParent(NearbyLandmarksPact, d));
        const query =
            (queryDog?.collected as OsmLandmarksQueryInput | undefined) ?? ({} as OsmLandmarksQueryInput);

        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampRadiusM(parseFloat(query.radius ?? ""));
        const facets = parseLandmarkFacets(query.preset);

        if (Number.isNaN(lat) || Number.isNaN(lng)) {
            throw new Error("OsmLandmarksRetriever: Missing required query params (lat, lng)");
        }

        return fetchNearbyLandmarks(lat, lng, radiusM, facets);
    };
}
