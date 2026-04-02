/**
 * =========================================================================
 *  WEATHER RETRIEVER — sniffin' out the sky-void's moods
 * =========================================================================
 *
 *  Arr, matey! This hound follows GPS coordinates into the brooding
 *  atmosphere, summoning current conditions and hourly forecasts
 *  from the eldritch depths of Open-Meteo.
 *
 *  Pass an optional time and the hound peers into the future,
 *  revealing what weather the void has planned for that hour.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason } from "@datadogs/core";
import { getWeather } from "./weatherApiClient";
import type { WeatherResult } from "./interfaces/weatherTypes";
import { WeatherQueryPact, type WeatherQuery } from "./pacts";
import { getBaseDogIcon } from '@datadogs/core';

/**
 * Arr, the WeatherRetriever — a spectral hound that sniffs out
 * atmospheric conditions near given GPS coordinates!
 * Temperature, wind, humidity, precipitation — all moods of the
 * sky-void dredged from the Open-Meteo abyss.
 */
export class WeatherRetriever extends Dog<WeatherResult> {
    get name(): string {
        return WeatherRetriever.name;
    }

    get icon(): string | undefined {
        return getBaseDogIcon(WeatherRetriever.name);
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [WeatherQueryPact];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<WeatherResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(WeatherQueryPact, d));
        const query = (queryDog?.collected as WeatherQuery | undefined) ?? ({} as WeatherQuery);

        const lat = parseFloat(query['lat']);
        const lng = parseFloat(query['lng']);

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error('WeatherRetriever: Missing required query params (lat, lng)');
        }

        return await getWeather(lat, lng, query['time'], query['date']);
    };
}
