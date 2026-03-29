import type { OpenRouteServiceResponse, IsochroneResponse } from "./interfaces/openRouteServiceResponse";
import type { TravelStepJson } from "./interfaces/bloodhoundTypes";

const apiKeys: string[] = process.env.ORS_API_KEYS?.split(',') || [];
let currentApiKeyIndex = 0;

function getApiKey(): string {
    const apiKey = apiKeys[currentApiKeyIndex];
    currentApiKeyIndex = (currentApiKeyIndex + 1) % apiKeys.length;
    return apiKey;
}

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
        if (!retry) {
            console.log("Too many requests for Route, using different API key.");
            currentApiKeyIndex = (currentApiKeyIndex + 1) % apiKeys.length;
            return calculateRoute(startLat, startLng, endLat, endLng, profile, true);
        }
        throw error;
    }
}

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
        if (!retry) {
            console.log("Too many requests for Isochrone, using different API key.");
            return calculateIsochrone(lat, lng, profile, range, true);
        }
        throw error;
    }
}

/** Lineare Schrittliste (ORS-Reihenfolge), ohne zirkuläre Objektgraphen — JSON-sicher. */
export function processRouteResponse(response: OpenRouteServiceResponse): TravelStepJson[] {
    const travelSteps: TravelStepJson[] = [];
    const coords = response.features[0].geometry.coordinates;
    const segments = response.features[0].properties.segments;

    segments.forEach(segment => {
        for (const step of segment.steps) {
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
