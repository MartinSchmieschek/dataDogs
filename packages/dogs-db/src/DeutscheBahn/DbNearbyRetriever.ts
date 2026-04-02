/**
 * =========================================================================
 *  DB NEARBY RETRIEVER — sniffin' out stations from the iron abyss
 * =========================================================================
 *
 *  Arr, matey! This hound follows GPS coordinates into the brooding
 *  gulfs of the Deutsche Bahn network, summoning nearby stations and
 *  their departures from the eldritch depths of HAFAS.
 *
 *  Each station reveals its departures — iron serpents bound for
 *  distant destinations, each one a journey deeper into the void.
 *  Through endless rails, countless forms, a multitude unfolds.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason } from "@datadogs/core";
import { fetchNearbyStations, fetchDepartures } from "./dbApiClient";
import type { DbNearbyResult, DbStationDepartures } from "./interfaces/dbTypes";
import { DbNearbyQueryPact, type DbNearbyQuery } from "./pacts";
import { getBaseDogIcon } from '@datadogs/core';

/**
 * Arr, the DbNearbyRetriever — a spectral hound that sniffs out Deutsche Bahn
 * stations near given GPS coordinates and plunders their departure boards!
 * From brooding platforms are we beheld, each departure a whisper from the void
 * revealing destinations where the iron serpents shall carry their cursed cargo.
 */
export class DbNearbyRetriever extends Dog<DbNearbyResult> {
    /** Arr, the name whispered by the void when it speaks of this hound */
    get name(): string {
        return DbNearbyRetriever.name;
    }

    /** The mark of our vessel — the iron sigil of the Deutsche Bahn */
    get icon(): string | undefined {
        return getBaseDogIcon(DbNearbyRetriever.name);
    }

    /** The unholy pacts this hound be shackled to — GPS coordinates from the mortal plane */
    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [DbNearbyQueryPact];
    }

    /** No optional anchors drag this vessel down */
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    /**
     * Arr, here we plunder the stations and departures from the Deutsche Bahn abyss!
     * First we summon nearby stations, then for each we dredge the departure board
     * from the HAFAS void — revealing destinations across the cursed rail network.
     */
    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<DbNearbyResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(DbNearbyQueryPact, d));
        const query = (queryDog?.collected as DbNearbyQuery | undefined) ?? ({} as DbNearbyQuery);

        const lat = parseFloat(query['lat']);
        const lng = parseFloat(query['lng']);
        const distance = parseInt(query['distance'] ?? '1000', 10);
        const results = parseInt(query['results'] ?? '8', 10);

        if (isNaN(lat) || isNaN(lng)) {
            throw new Error('DbNearbyRetriever: Missing required query params (lat, lng)');
        }

        // Summon nearby stations from the iron abyss
        const stations = await fetchNearbyStations(lat, lng, distance, results);

        // For each station, dredge the departure board from the void
        const stationDepartures: DbStationDepartures[] = await Promise.all(
            stations.map(async (station) => {
                try {
                    const departures = await fetchDepartures(station.id);
                    return { station, departures };
                } catch (err) {
                    console.warn(`[DbNearbyRetriever] Failed to fetch departures for ${station.name}: ${err}`);
                    return { station, departures: [] };
                }
            })
        );

        return {
            stations: stationDepartures,
            stationCount: stationDepartures.length,
            searchLocation: { lat, lng },
        };
    };
}
