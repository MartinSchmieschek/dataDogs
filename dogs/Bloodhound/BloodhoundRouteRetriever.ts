import { Dog, IHuntingDog, IHuntingSeason } from "datadogs";
import { calculateRoute, processRouteResponse } from "./routeCalculator";
import type { BloodhoundRouteResult, RouteSegment } from "./interfaces/bloodhoundTypes";
import { BloodhoundRouteQueryPact, type BloodhoundRouteQuery } from "./pacts";

export class BloodhoundRouteRetriever extends Dog<BloodhoundRouteResult> {
    get name(): string {
        return BloodhoundRouteRetriever.name;
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [BloodhoundRouteQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<BloodhoundRouteResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(BloodhoundRouteQueryPact, d));
        const query = (queryDog?.collected as BloodhoundRouteQuery | undefined) ?? ({} as BloodhoundRouteQuery);

        const startLat = parseFloat(query['startlat']);
        const startLng = parseFloat(query['startlng']);
        const endLat = parseFloat(query['endlat']);
        const endLng = parseFloat(query['endlng']);
        const profile = query['profile'] || 'foot-walking';

        if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
            throw new Error('BloodhoundRouteRetriever: Missing required query params (startlat, startlng, endlat, endlng)');
        }

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
}
