import type { OpenRouteServiceResponse, IsochroneResponse } from "./interfaces/openRouteServiceResponse";
import type { TravelStep } from "./interfaces/bloodhoundTypes";

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

export function processRouteResponse(response: OpenRouteServiceResponse): TravelStep[] {
    const travelSteps: TravelStep[] = [];
    const segments = response.features[0].properties.segments;

    segments.forEach(segment => {
        const steps = segment.steps;

        steps.forEach((step, index) => {
            const coords = response.features[0].geometry.coordinates;

            const startPoint: [number, number] = [
                coords[step.way_points[0]][1],
                coords[step.way_points[0]][0]
            ];

            const endPoint: [number, number] = [
                coords[step.way_points[step.way_points.length - 1]][1],
                coords[step.way_points[step.way_points.length - 1]][0]
            ];

            const lengthInKm = step.distance / 1000;
            const travelDurationInMinutes = step.duration / 60;
            const previousSteps = travelSteps.slice(0, index);

            const nextSteps: TravelStep[] = [];
            for (let i = index + 1; i < steps.length; i++) {
                const nextStep = steps[i];
                nextSteps.push({
                    startPoint: [
                        coords[nextStep.way_points[0]][1],
                        coords[nextStep.way_points[0]][0]
                    ],
                    endPoint: [
                        coords[nextStep.way_points[nextStep.way_points.length - 1]][1],
                        coords[nextStep.way_points[nextStep.way_points.length - 1]][0]
                    ],
                    lengthInKm: nextStep.distance / 1000,
                    travelDurationInMinutes: nextStep.duration / 60,
                    instruction: nextStep.instruction,
                    previousSteps: [travelSteps[index], ...previousSteps],
                    nextSteps: []
                });
            }

            const travelStep: TravelStep = {
                startPoint,
                endPoint,
                lengthInKm,
                travelDurationInMinutes,
                instruction: step.instruction,
                previousSteps,
                nextSteps
            };

            previousSteps.forEach(prevStep => {
                prevStep.nextSteps.push(travelStep);
            });

            travelSteps.push(travelStep);
        });
    });

    return travelSteps;
}
