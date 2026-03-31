/**
 * =========================================================================
 *  BLOODHOUND TYPES — the shapes that lurk in the abyss
 * =========================================================================
 *
 *  Arr, these be the cursed type definitions that give form to the
 *  formless. From brooding gulfs are we beheld, by that which bears
 *  no name — yet here we dare name it anyway, matey.
 *
 *  In luminous space blackened stars, they gaze, accuse, deny —
 *  and so these interfaces gaze back at ye, definin' the very
 *  geometry of the deep.
 * =========================================================================
 */

/**
 * Arr, a single step upon the route — safe for JSON.stringify, free of
 * circular graph-horrors that would drive a crew to madness.
 * Corporeal laws are unwritten, as suns and love retreat.
 */
export interface TravelStepJson {
    /** Arr, the [lat, lng] where this cursed step begins — the first glimpse into the abyss */
    startPoint: [number, number];
    /** The [lat, lng] where this step ends, matey — deeper still into the eldritch void */
    endPoint: [number, number];
    /** Distance plundered in kilometers — how far the crew sailed through the deep */
    lengthInKm: number;
    /** Minutes lost to the void, arr — time consumed by this leg of the voyage */
    travelDurationInMinutes: number;
    /** The navigation instruction — whispered directions from brooding gulfs beyond */
    instruction: string;
}

/** A segment of the voyage — distance plundered and time lost to the void */
export interface RouteSegment {
    /** Arr, cumulative kilometers traversed — the total distance plundered from the void so far */
    traveldKm: number;
    /** Cumulative minutes elapsed, matey — time swallowed by the eldritch deep */
    time: number;
    /** The [lat, lng] waypoints of this segment — coordinates dredged from the abyss */
    points: [number, number][];
}

/** The full plunder of a route retrieval from the deep */
export interface BloodhoundRouteResult {
    /** Arr, the raw coordinate array — the full geometry of the route as charted by the void */
    coordinates: number[][];
    /** Cumulative route segments, matey — each one a deeper descent into the abyss */
    segments: RouteSegment[];
    /** The individual travel steps — eldritch instructions from the deep, JSON-safe and fearsome */
    travelSteps: TravelStepJson[];
}

/** The eldritch yield of an isochrone query — boundaries of the reachable abyss */
export interface BloodhoundIsochroneResult {
    /** Arr, the parsed isochrone features — boundaries of the reachable deep, in [lat, lng] form */
    features: IsochroneFeatureResult[];
    /** The raw response from the void, matey — unprocessed eldritch data for those who dare gaze upon it */
    raw: unknown;
}

/** A single isochrone feature — the void's boundary made manifest, matey */
export interface IsochroneFeatureResult {
    /** Arr, the polygon coordinates — the boundary of the void's reach, in [lat, lng] pairs */
    coordinates: [number, number][];
    /** The isochrone value in seconds — how deep into the abyss this boundary extends */
    value: number;
    /** The [lat, lng] center of this eldritch polygon — where the horror emanates from, matey */
    center: [number, number];
}
