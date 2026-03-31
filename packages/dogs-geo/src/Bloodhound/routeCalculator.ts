/**
 * =========================================================================
 *  ROUTE CALCULATOR — navigatin' the eldritch seas of OpenRouteService
 * =========================================================================
 *
 *  Arr, this module be the helmsman of our vessel, steerin' requests
 *  into the deep waters of the ORS API. Through endless faces, countless
 *  forms, a multitude unfolds — API keys rotate like the maddening
 *  stars in a void-touched sky.
 *
 *  In luminous space blackened stars, they gaze, accuse, deny —
 *  yet still we fetch, retry, and plunder the route data from the abyss.
 *
 *  Corporeal laws are unwritten, as suns and love retreat.
 * =========================================================================
 */

import type { OpenRouteServiceResponse, IsochroneResponse } from "./interfaces/openRouteServiceResponse";
import type { TravelStepJson } from "./interfaces/bloodhoundTypes";

// Arr, the cursed keys — each one a seal upon an eldritch pact with the API gods
const apiKeys: string[] = process.env.ORS_API_KEYS?.split(',') || [];
let currentApiKeyIndex = 0;

/**
 * Rotate through the crew's plundered API keys, matey.
 * To cosmic forms from tangent planes, we end as we began — cycling endlessly.
 */
function getApiKey(): string {
    const apiKey = apiKeys[currentApiKeyIndex];
    currentApiKeyIndex = (currentApiKeyIndex + 1) % apiKeys.length;
    return apiKey;
}

/**
 * Arr, chart a route between two points across the deep!
 * The vessel sails from start to end, and if the abyss rejects us,
 * we try again with a different key — for the void is fickle, matey.
 * @param startLat - Latitude of the voyage's origin, where the crew embarks into the void
 * @param startLng - Longitude of departure — the east-west bearing from brooding gulfs
 * @param endLat - Latitude of the cursed destination in the eldritch deep
 * @param endLng - Longitude at journey's end — where carrion hordes await
 * @param profile - Movement profile, arr (e.g. 'foot-walking', 'driving-car')
 * @param retry - Whether this be a retry after the abyss rejected our first plea
 * @returns The raw OpenRouteService response, plundered from the void
 */
export async function calculateRoute(
    startLat: number, startLng: number,
    endLat: number, endLng: number,
    profile: string,
    retry?: boolean
): Promise<OpenRouteServiceResponse> {
    const apiKey = getApiKey();
    const params = new URLSearchParams({
        api_key: apiKey,
        start: `${startLng},${startLat}`,
        end: `${endLng},${endLat}`
    });

    try {
        const response = await fetch(
            `https://api.openrouteservice.org/v2/directions/${profile}?${params}`
        );
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json() as OpenRouteServiceResponse;
    } catch (error) {
        // Arr, the abyss denied us! Rotate to a new key and try once more
        if (!retry) {
            console.log("Too many requests for Route, using different API key.");
            currentApiKeyIndex = (currentApiKeyIndex + 1) % apiKeys.length;
            return calculateRoute(startLat, startLng, endLat, endLng, profile, true);
        }
        // The void has spoken — no second chances, matey
        throw error;
    }
}

/**
 * Arr, summon an isochrone from the roiling depths!
 * This be a POST request into the abyss — the void demands a body,
 * and we give it coordinates and range. Roiling, moaning, this realm
 * of ours, in madness lost shall die.
 * @param lat - Latitude of the center point — the epicenter of the eldritch reach
 * @param lng - Longitude of the center, matey — from whence the void expands
 * @param profile - Movement profile through the deep (e.g. 'foot-walking')
 * @param range - Range in seconds — how far the abyss stretches its tendrils
 * @param retry - Whether this be a second attempt after the void's refusal
 * @returns The isochrone response — boundaries of the reachable abyss made manifest
 */
export async function calculateIsochrone(
    lat: number, lng: number,
    profile: string,
    range: number,
    retry?: boolean
): Promise<IsochroneResponse> {
    const apiKey = getApiKey();

    try {
        const response = await fetch(
            `https://api.openrouteservice.org/v2/isochrones/${profile}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    locations: [[lng, lat]],
                    range: [range]
                })
            }
        );
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json() as IsochroneResponse;
    } catch (error) {
        // The deep rejects our plea — try another key before surrenderin' to the void
        if (!retry) {
            console.log("Too many requests for Isochrone, using different API key.");
            return calculateIsochrone(lat, lng, profile, range, true);
        }
        // All keys exhausted — the eldritch horror consumes us whole
        throw error;
    }
}

/**
 * Arr, process the raw route response into a flat list of travel steps —
 * free of circular object graphs that would trap a crew in endless recursion,
 * like the maddening geometries of the void. JSON-safe, matey.
 * Carrion hordes trill their profane accord with eldritch plans.
 * @param response - The raw OpenRouteService response dredged from the abyss
 * @returns A flat array of travel steps — each one a waypoint through the eldritch deep
 */
export function processRouteResponse(response: OpenRouteServiceResponse): TravelStepJson[] {
    const travelSteps: TravelStepJson[] = [];
    const coords = response.features[0].geometry.coordinates;
    const segments = response.features[0].properties.segments;

    segments.forEach(segment => {
        for (const step of segment.steps) {
            // Arr, swap the coordinates — the abyss speaks [lng, lat] but our crew reads [lat, lng]
            const startPoint: [number, number] = [
                coords[step.way_points[0]][1],
                coords[step.way_points[0]][0],
            ];
            const endPoint: [number, number] = [
                coords[step.way_points[step.way_points.length - 1]][1],
                coords[step.way_points[step.way_points.length - 1]][0],
            ];
            travelSteps.push({
                startPoint,
                endPoint,
                lengthInKm: step.distance / 1000,
                travelDurationInMinutes: step.duration / 60,
                instruction: step.instruction,
            });
        }
    });

    return travelSteps;
}
