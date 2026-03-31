/**
 * =========================================================================
 *  BLOODHOUND ROUTE RETRIEVER — chartin' a course through the void
 * =========================================================================
 *
 *  Arr, matey! This be the vessel that charts a route between two
 *  cursed coordinates across the deep. In luminous space blackened
 *  stars gaze, accuse, deny — yet still we sail, segment by segment,
 *  step by eldritch step.
 *
 *  Carrion hordes trill their profane accord with eldritch plans,
 *  and so this retriever breaks the route into segments of madness,
 *  each one a waypoint deeper into the abyss.
 *
 *  To cosmic forms from tangent planes, we end as we began.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason } from "@datadogs/core";
import { calculateRoute, processRouteResponse } from "./routeCalculator";
import type { BloodhoundRouteResult, RouteSegment } from "./interfaces/bloodhoundTypes";
import { BloodhoundRouteQueryPact, type BloodhoundRouteQuery } from "./pacts";
import { getBaseDogIcon } from '@datadogs/core';

/**
 * Arr, the BloodhoundRouteRetriever — a spectral hound that charts a course
 * between two cursed coordinates through the void! Carrion hordes trill their
 * profane accord as this vessel plunders route segments from the eldritch depths
 * of OpenRouteService, each waypoint a deeper descent into the abyss.
 * In luminous space blackened stars gaze, accuse, deny — yet still we sail.
 */
export class BloodhoundRouteRetriever extends Dog<BloodhoundRouteResult> {
    /** Arr, the name whispered by the void when it speaks of this hound */
    get name(): string {
        return BloodhoundRouteRetriever.name;
    }

    /** The mark of our vessel — branded upon us by forces beyond the deep */
    get icon(): string | undefined {
        return getBaseDogIcon(BloodhoundRouteRetriever.name);
    }

    /** The unholy pacts this hound be shackled to, matey */
    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [BloodhoundRouteQueryPact];
    }

    /** No optional anchors drag this vessel down */
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    /**
     * Arr, here we plunder the route from the abyss!
     * Through endless faces, countless forms, a multitude unfolds —
     * each travel step a deeper descent into cosmic madness.
     */
    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<BloodhoundRouteResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(BloodhoundRouteQueryPact, d));
        const query = (queryDog?.collected as BloodhoundRouteQuery | undefined) ?? ({} as BloodhoundRouteQuery);

        const startLat = parseFloat(query['startlat']);
        const startLng = parseFloat(query['startlng']);
        const endLat = parseFloat(query['endlat']);
        const endLng = parseFloat(query['endlng']);
        const profile = query['profile'] || 'foot-walking';

        // If the coordinates be swallowed by the void, we cannot navigate the deep
        if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
            throw new Error('BloodhoundRouteRetriever: Missing required query params (startlat, startlng, endlat, endlng)');
        }

        // Descend into the eldritch depths and retrieve the route
        const response = await calculateRoute(startLat, startLng, endLat, endLng, profile);
        const coordinates = response.features[0].geometry.coordinates;
        const travelSteps = processRouteResponse(response);

        // Accumulate the dread — each segment adds to the cosmic distance traversed
        let cumulativeKm = 0;
        let cumulativeMinutes = 0;
        const segments: RouteSegment[] = travelSteps.map(step => {
            cumulativeKm += step.lengthInKm;
            cumulativeMinutes += step.travelDurationInMinutes;
            return {
                traveldKm: cumulativeKm,
                time: cumulativeMinutes,
                points: [step.startPoint, step.endPoint]
            };
        });

        return { coordinates, segments, travelSteps };
    };
}
