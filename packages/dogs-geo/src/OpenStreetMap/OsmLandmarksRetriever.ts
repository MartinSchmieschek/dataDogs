/**
 * =========================================================================
 *  OSM LANDMARKS RETRIEVER — dredgin' landmarks from the cartographic abyss
 * =========================================================================
 *
 *  Arr, this vessel sails the cursed waters of OpenStreetMap, retrievin'
 *  landmarks that lurk near a given coordinate. From brooding gulfs are
 *  we beheld, by that which bears no name — and so we query the Overpass
 *  API, that eldritch oracle of geographic horror.
 *
 *  Its heralds are the stars it fells, the sky and Earth aflame.
 *  Through endless faces, countless forms, a multitude unfolds —
 *  each landmark a whisper from the deep.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason } from "@datadogs/core";
import { NearbyLandmarksPact, type OsmLandmarksQueryInput } from "./pacts";
import {
    clampRadiusM,
    fetchNearbyLandmarks,
    parseLandmarkFacets,
    type OsmLandmarksResult,
} from "./overpassLandmarks";
import { getBaseDogIcon } from "@datadogs/core";

/**
 * Arr, the OsmLandmarksRetriever — a hound that dredges landmarks from the
 * cartographic abyss of OpenStreetMap! From brooding gulfs it queries the
 * Overpass API, that eldritch oracle, returnin' nodes and ways no mortal
 * cartographer was meant to catalogue. The void yields its secrets, matey,
 * through endless faces countless forms, each landmark a whisper from the deep.
 */
export class OsmLandmarksRetriever extends Dog<OsmLandmarksResult> {
    /** Arr, the name by which the abyss calls this landmark-huntin' hound */
    get name(): string {
        return OsmLandmarksRetriever.name;
    }

    /** The sigil branded upon our vessel by cosmic forces beyond comprehension */
    get icon(): string | undefined {
        return getBaseDogIcon(OsmLandmarksRetriever.name);
    }

    /** The pact that binds us — an eldritch accord with the query provider, matey */
    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [NearbyLandmarksPact];
    }

    /** No optional horrors burden this crew */
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    /**
     * Arr, plunder the nearby landmarks from the Overpass abyss!
     * To cosmic madness laws submit, though stalwart minds entreat —
     * we parse, we clamp, we fetch, and pray the void returns data.
     */
    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<OsmLandmarksResult> => {
        const queryDog = season.exhausted.find((d) => this.matchesParent(NearbyLandmarksPact, d));
        const query =
            (queryDog?.collected as OsmLandmarksQueryInput | undefined) ?? ({} as OsmLandmarksQueryInput);

        const lat = parseFloat(query.lat);
        const lng = parseFloat(query.lng);
        const radiusM = clampRadiusM(parseFloat(query.radius ?? ""));
        const facets = parseLandmarkFacets(query.preset);

        // If coordinates be lost to the void, no landmarks can be dredged from the deep
        if (Number.isNaN(lat) || Number.isNaN(lng)) {
            throw new Error("OsmLandmarksRetriever: Missing required query params (lat, lng)");
        }

        return fetchNearbyLandmarks(lat, lng, radiusM, facets);
    };
}
