/**
 * =========================================================================
 *  BLOODHOUND ISOCHRONE RETRIEVER — the reach of the void made manifest
 * =========================================================================
 *
 *  Arr, this vessel charts the boundaries of how far a soul can wander
 *  within a given time — like the creeping edge of an eldritch horror
 *  expandin' across the deep. Its heralds are the stars it fells, the
 *  sky and Earth aflame with isochrone polygons of dread.
 *
 *  From brooding gulfs are we beheld, by that which bears no name —
 *  and so too does this retriever gaze into the abyss of
 *  OpenRouteService, returnin' geometries no mortal was meant to see.
 *
 *  To cosmic madness laws submit, though stalwart minds entreat.
 * =========================================================================
 */

import { Dog, IHuntingDog, IHuntingSeason, type ICacheHandler, type ICacheable } from "@datadogs/core";
import { BloodhoundIsochronePact, BloodhoundProfile, DEFAULT_BLOODHOUND_PROFILE, type BloodhoundIsochroneInput } from "./pacts";
import { calculateIsochrone } from "./routeCalculator";
import type { BloodhoundIsochroneResult, IsochroneFeatureResult } from "./interfaces/bloodhoundTypes";
import { getBaseDogIcon } from '@datadogs/core';

/**
 * Arr, the BloodhoundIsochroneRetriever — a cursed hound that charts the reach
 * of the void made manifest! From brooding gulfs it summons isochrone polygons,
 * revealin' how far a soul can wander before the eldritch deep reclaims 'em.
 * Through endless faces countless forms, this vessel plunders boundaries
 * from the OpenRouteService abyss, where corporeal laws be unwritten.
 */
export class BloodhoundIsochroneRetriever extends Dog<BloodhoundIsochroneResult> implements ICacheable {
    private cacheHandler?: ICacheHandler;

    constructor() {
        super();
        if (!process.env.ORS_API_KEYS?.trim()) {
            throw new Error('BloodhoundIsochroneRetriever: ORS_API_KEYS not set. Get a free key at https://openrouteservice.org/dev/#/signup');
        }
    }

    setCacheHandler(handler: ICacheHandler): void {
        this.cacheHandler = handler;
    }

    /** Arr, the name by which the abyss knows this cursed hound */
    get name(): string {
        return BloodhoundIsochroneRetriever.name;
    }

    get description(): string {
        return 'Calculates reachability polygons (isochrones) from a center point via OpenRouteService.';
    }

    /** The sigil of our vessel, glimpsed in luminous space of blackened stars */
    get icon(): string | undefined {
        return getBaseDogIcon(BloodhoundIsochroneRetriever.name);
    }

    /** The pacts we be bound to — eldritch accords no crew member can escape */
    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [BloodhoundIsochronePact];
    }

    /** No optional horrors today, matey — the void demands nothing more */
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    /** Carry the movement profiles into the VM so SerializedDog children can use them */
    getVmContextContributions(): Record<string, any> {
        return {
            BloodhoundProfile,
            DEFAULT_BLOODHOUND_PROFILE,
        };
    }

    /**
     * Arr, here we plunder the isochrone from the deep!
     * Corporeal laws are unwritten as suns and love retreat —
     * coordinates be swapped, for the abyss speaks in [lng, lat]
     * but we mortal crew prefer [lat, lng].
     */
    protected yieldCollectorFactory = async (season: IHuntingSeason): Promise<BloodhoundIsochroneResult> => {
        const queryDog = season.exhausted.find(d => this.matchesParent(BloodhoundIsochronePact, d));
        const input: BloodhoundIsochroneInput = (queryDog?.collected as BloodhoundIsochroneInput | undefined) ?? { lat: '', lng: '', range: '' };

        const lat = parseFloat(input.lat);
        const lng = parseFloat(input.lng);
        const profile = input.profile ?? DEFAULT_BLOODHOUND_PROFILE;
        const range = parseInt(input.range, 10);

        // If the coordinates be lost to the void, we cannot sail — abandon ship!
        if (isNaN(lat) || isNaN(lng) || isNaN(range)) {
            throw new Error('BloodhoundIsochroneRetriever: Missing required params (lat, lng, range)');
        }

        const key = `isochrone:${profile}:${lat}:${lng}:${range}`;

        const fetchIsochrone = async (): Promise<BloodhoundIsochroneResult> => {
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

        if (this.cacheHandler) {
            return this.cacheHandler.getOrFetch(key, 24 * 60 * 60_000, fetchIsochrone);
        }
        return fetchIsochrone();
    };
}
