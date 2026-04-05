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

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@datadogs/core";
import { calculateRoute, processRouteResponse } from "./routeCalculator";
import type { BloodhoundRouteResult, RouteSegment } from "./interfaces/bloodhoundTypes";
import { BloodhoundRouteQueryPact, BloodhoundProfile, DEFAULT_BLOODHOUND_PROFILE, type BloodhoundRouteQuery } from "./pacts";
import { getBaseDogIcon } from '@datadogs/core';

/**
 * Arr, the BloodhoundRouteRetriever — a spectral hound that charts a course
 * between two cursed coordinates through the void! Carrion hordes trill their
 * profane accord as this vessel plunders route segments from the eldritch depths
 * of OpenRouteService, each waypoint a deeper descent into the abyss.
 * In luminous space blackened stars gaze, accuse, deny — yet still we sail.
 */
export class BloodhoundRouteRetriever extends Dog<BloodhoundRouteResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    constructor() {
        super();
        if (!process.env.ORS_API_KEYS?.trim()) {
            throw new Error('BloodhoundRouteRetriever: ORS_API_KEYS not set. Get a free key at https://openrouteservice.org/dev/#/signup');
        }
    }

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    /** Arr, the name whispered by the void when it speaks of this hound */
    get name(): string {
        return BloodhoundRouteRetriever.name;
    }

    get description(): string {
        return 'Calculates a walking/driving route between two coordinates via OpenRouteService.';
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

    /** Carry the movement profiles into the VM so SerializedDog children can use them */
    getVmContextContributions(): Record<string, any> {
        return {
            BloodhoundProfile,
            DEFAULT_BLOODHOUND_PROFILE,
        };
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
        const profile = query['profile'] || DEFAULT_BLOODHOUND_PROFILE;

        // If the coordinates be swallowed by the void, we cannot navigate the deep
        if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
            throw new Error('BloodhoundRouteRetriever: Missing required query params (startlat, startlng, endlat, endlng)');
        }

        const key = `route:${profile}:${startLat}:${startLng}:${endLat}:${endLng}`;

        const fetchRoute = async (): Promise<BloodhoundRouteResult> => {
            const response = await calculateRoute(startLat, startLng, endLat, endLng, profile);
            const coordinates = response.features[0].geometry.coordinates;
            const travelSteps = processRouteResponse(response);

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

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 24 * 60 * 60_000, fetchRoute);
        }
        return fetchRoute();
    };
}
