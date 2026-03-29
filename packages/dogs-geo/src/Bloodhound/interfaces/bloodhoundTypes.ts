/**
 * Ein Routenschritt ohne Graph-Referenzen — sicher für JSON.stringify / API.
 */
export interface TravelStepJson {
    startPoint: [number, number];
    endPoint: [number, number];
    lengthInKm: number;
    travelDurationInMinutes: number;
    instruction: string;
}

export interface RouteSegment {
    traveldKm: number;
    time: number;
    points: [number, number][];
}

export interface BloodhoundRouteResult {
    coordinates: number[][];
    segments: RouteSegment[];
    travelSteps: TravelStepJson[];
}

export interface BloodhoundIsochroneResult {
    features: IsochroneFeatureResult[];
    raw: unknown;
}

export interface IsochroneFeatureResult {
    coordinates: [number, number][];
    value: number;
    center: [number, number];
}
