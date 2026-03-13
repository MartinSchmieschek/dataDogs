import { Dog, IHuntingDog, IHuntingSeason } from "datadogs";
import { QueryRetriever } from "../QueryRetriever";
import { calculateIsochrone } from "./routeCalculator";
import type { BloodhoundIsochroneResult, IsochroneFeatureResult } from "./interfaces/bloodhoundTypes";

export class BloodhoundIsochroneRetriever extends Dog<BloodhoundIsochroneResult> {
    get name(): string {
        return BloodhoundIsochroneRetriever.name;
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [QueryRetriever];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<BloodhoundIsochroneResult> => {
        const queryDog = season.exhausted.find(d => d.name === QueryRetriever.name);
        const query = (queryDog?.collected as Record<string, string>) ?? {};

        const lat = parseFloat(query['lat']);
        const lng = parseFloat(query['lng']);
        const profile = query['profile'] || 'foot-walking';
        const range = parseInt(query['range']);

        if (isNaN(lat) || isNaN(lng) || isNaN(range)) {
            throw new Error('BloodhoundIsochroneRetriever: Missing required query params (lat, lng, range)');
        }

        const response = await calculateIsochrone(lat, lng, profile, range);

        const features: IsochroneFeatureResult[] = response.features.map(feature => ({
            coordinates: feature.geometry.coordinates[0].map(
                coord => [coord[1], coord[0]] as [number, number]
            ),
            value: feature.properties.value,
            center: [feature.properties.center[1], feature.properties.center[0]] as [number, number]
        }));

        return { features, raw: response };
    };
}
