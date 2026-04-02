/**
 * =========================================================================
 *  AIR QUALITY RETRIEVER — sniffin' the particles from the breathing void
 * =========================================================================
 *
 *  Arr, matey! This hound follows GPS coordinates into the brooding
 *  atmosphere, summoning pollution data and pollen counts
 *  from the eldritch depths of Open-Meteo Air Quality.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason } from "@datadogs/core";
import { getAirQuality } from "./airQualityApiClient";
import type { AirQualityResult } from "./interfaces/airQualityTypes";
import { AirQualityQueryPact, type AirQualityQuery } from "./pacts";
import { getBaseDogIcon } from '@datadogs/core';

/**
 * Arr, the AirQualityRetriever — a spectral hound that sniffs out
 * atmospheric pollutants and pollen near given GPS coordinates!
 * PM2.5, PM10, Ozon, NO2, Pollenflug — the breathing void laid bare.
 */
export class AirQualityRetriever extends Dog<AirQualityResult> {
    get name(): string { return AirQualityRetriever.name; }
    get icon(): string | undefined { return getBaseDogIcon(AirQualityRetriever.name); }
    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] { return [AirQualityQueryPact]; }
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] { return []; }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<AirQualityResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(AirQualityQueryPact, d));
        const query = (queryDog?.collected as AirQualityQuery | undefined) ?? ({} as AirQualityQuery);

        const lat = parseFloat(query['lat']);
        const lng = parseFloat(query['lng']);

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error('AirQualityRetriever: Missing required query params (lat, lng)');
        }

        return await getAirQuality(lat, lng);
    };
}
