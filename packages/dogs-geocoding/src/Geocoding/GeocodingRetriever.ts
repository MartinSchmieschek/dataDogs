/**
 * =========================================================================
 *  GEOCODING RETRIEVER — translating names and coordinates from the map-void
 * =========================================================================
 *
 *  Arr, matey! This hound translates between the mortal tongue of
 *  addresses and the cosmic language of coordinates.
 *
 *  Pass `address` for forward geocoding (Adresse -> GPS).
 *  Pass `lat`+`lng` for reverse geocoding (GPS -> Adresse).
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason } from "@datadogs/core";
import { forwardGeocode, reverseGeocode } from "./geocodingApiClient";
import type { GeocodingResult } from "./interfaces/geocodingTypes";
import { GeocodingQueryPact, type GeocodingQuery } from "./pacts";
import { getBaseDogIcon } from '@datadogs/core';

/**
 * Arr, the GeocodingRetriever — a spectral hound that translates
 * between addresses and GPS coordinates via Nominatim (OpenStreetMap).
 * Forward: "Hauptwache Frankfurt" -> lat/lng.
 * Reverse: lat/lng -> "Braubachstrasse 41, Frankfurt am Main".
 */
export class GeocodingRetriever extends Dog<GeocodingResult> {
    get name(): string { return GeocodingRetriever.name; }
    get description(): string { return 'Converts addresses to GPS coordinates (geocoding) via Nominatim/OpenStreetMap.'; }
    get icon(): string | undefined { return getBaseDogIcon(GeocodingRetriever.name); }
    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] { return [GeocodingQueryPact]; }
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] { return []; }

    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<GeocodingResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(GeocodingQueryPact, d));
        const query = (queryDog?.collected as GeocodingQuery | undefined) ?? ({} as GeocodingQuery);

        const address = query['address'];
        const lat = query['lat'] ? parseFloat(query['lat']) : NaN;
        const lng = query['lng'] ? parseFloat(query['lng']) : NaN;
        const limit = parseInt(query['limit'] ?? '5', 10);

        // Forward geocoding has priority
        if (address) {
            return await forwardGeocode(address, limit);
        }

        // Reverse geocoding
        if (!isNaN(lat) && !isNaN(lng)) {
            return await reverseGeocode(lat, lng);
        }

        throw new Error('GeocodingRetriever: Missing query params — provide `address` or `lat`+`lng`');
    };
}
