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

import { Dog, IHuntingDog, IHuntingSeason } from "@datadogs/core";
import { BloodhoundIsochronePact, type BloodhoundIsochroneInput } from "./pacts";
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
export class BloodhoundIsochroneRetriever extends Dog<BloodhoundIsochroneResult> {
    /** Arr, the name by which the abyss knows this cursed hound */
    get name(): string {
        return BloodhoundIsochroneRetriever.name;
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
        const profile = input.profile ?? 'foot-walking';
        const range = parseInt(input.range, 10);

        // If the coordinates be lost to the void, we cannot sail — abandon ship!
        if (isNaN(lat) || isNaN(lng) || isNaN(range)) {
            throw new Error('BloodhoundIsochroneRetriever: Missing required params (lat, lng, range)');
        }

        // Descend into the abyss and retrieve the isochrone geometries
        const response = await calculateIsochrone(lat, lng, profile, range);

        // Roiling, moaning, this realm of ours — transform the eldritch coordinates
        // from the void's [lng, lat] tongue to our crew's [lat, lng] convention
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
