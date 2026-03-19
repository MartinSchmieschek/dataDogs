import { Dog, IHuntingDog, IHuntingSeason } from "datadogs";
import { NearbyLandmarksPact, type NearbyLandmarksQuery } from "./pacts";
import {
    clampRadiusM,
    fetchNearbyLandmarks,
    parseLandmarksPreset,
    type OsmLandmarksResult,
} from "./overpassLandmarks";
import { getBaseDogIcon } from "../baseDogIcons";

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
            (queryDog?.collected as NearbyLandmarksQuery | undefined) ?? ({} as NearbyLandmarksQuery);

        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampRadiusM(parseFloat(query.radius ?? ""));
        const preset = parseLandmarksPreset(query.preset);

        if (Number.isNaN(lat) || Number.isNaN(lng)) {
            throw new Error("OsmLandmarksRetriever: Missing required query params (lat, lng)");
        }

        return fetchNearbyLandmarks(lat, lng, radiusM, preset);
    };
}
