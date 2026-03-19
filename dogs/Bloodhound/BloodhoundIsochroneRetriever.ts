import { Dog, IHuntingDog, IHuntingSeason } from "datadogs";
import { BloodhoundIsochronePact, type BloodhoundIsochroneInput } from "./pacts";
import { calculateIsochrone } from "./routeCalculator";
import type { BloodhoundIsochroneResult, IsochroneFeatureResult } from "./interfaces/bloodhoundTypes";
import { getBaseDogIcon } from '../baseDogIcons';

export class BloodhoundIsochroneRetriever extends Dog<BloodhoundIsochroneResult> {
    get name(): string {
        return BloodhoundIsochroneRetriever.name;
    }

    get icon(): string | undefined {
        return getBaseDogIcon(BloodhoundIsochroneRetriever.name);
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [BloodhoundIsochronePact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<BloodhoundIsochroneResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(BloodhoundIsochronePact, d));
        const input: BloodhoundIsochroneInput = (queryDog?.collected as BloodhoundIsochroneInput | undefined) ?? { lat: '', lng: '', range: '' };

        const lat = parseFloat(input.lat);
        const lng = parseFloat(input.lng);
        const profile = input.profile ?? 'foot-walking';
        const range = parseInt(input.range, 10);

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
