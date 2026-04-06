/**
 * =========================================================================
 *  BLOODHOUND PACTS — eldritch accords sworn in the deep
 * =========================================================================
 *
 *  Arr, these be the unholy pacts that bind our vessel's crew to the
 *  cosmic horrors of data retrieval. Carrion hordes trill their profane
 *  accord with eldritch plans — and so do we, through these typed
 *  contracts with the abyss.
 *
 *  To cosmic madness laws submit, though stalwart minds entreat.
 *  No crew member escapes the pact once signed, matey.
 * =========================================================================
 */

import { createPact } from "@datadogs/core";

/** Movement profiles supported by OpenRouteService */
export enum BloodhoundProfile {
    FootWalking = "foot-walking",
    Hiking = "foot-hiking",
    DrivingCar = "driving-car",
    CyclingRegular = "cycling-regular",
    CyclingRoad = "cycling-road",
    CyclingMountain = "cycling-mountain",
    CyclingElectric = "cycling-electric",
    Wheelchair = "wheelchair",
}

/** The default profile when none is specified */
export const DEFAULT_BLOODHOUND_PROFILE = BloodhoundProfile.FootWalking;

/** Query parameters for the BloodhoundRouteRetriever — the vessel's heading through the void (lowercase keys from the QueryRetriever) */
export interface BloodhoundRouteQuery {
    /** Arr, the latitude where our voyage begins — the first coordinate whispered to the void */
    startlat: string;
    /** The longitude of departure, matey — from brooding gulfs we set sail */
    startlng: string;
    /** The latitude of our cursed destination — where the abyss awaits the crew */
    endlat: string;
    /** The longitude at journey's end — through endless faces countless forms we arrive */
    endlng: string;
    /** The movement profile, arr — how the crew traverses the eldritch deep (e.g. 'foot-walking') */
    profile?: string;
}

/** The coordinates and range fed to the isochrone abyss */
export interface BloodhoundIsochroneInput {
    /** Arr, the latitude at the center of the void's reach — where the eldritch boundary emanates */
    lat: string;
    /** The longitude of the epicenter, matey — corporeal laws unwritten radiate from this point */
    lng: string;
    /** The movement profile — how the carrion hordes traverse the deep (e.g. 'foot-walking') */
    profile?: string;
    /** The range in seconds, arr — how far into the abyss the isochrone dares extend */
    range: string;
}

/** Arr, the route query pact — an anchor binding retriever to its dark source */
export const BloodhoundRouteQueryPact = createPact<BloodhoundRouteQuery>(
    "BloodhoundQueryProvider",
    { fromSourceType: "BloodhoundRouteQuery" }
);

/** The isochrone pact — from brooding gulfs are we beheld, by that which bears no name */
export const BloodhoundIsochronePact = createPact<BloodhoundIsochroneInput>(
    "BloodhoundIsochroneProvider",
    { fromSourceType: "BloodhoundIsochroneInput" }
);
