export interface TravelStep {
    startPoint: [number, number];
    endPoint: [number, number];
    lengthInKm: number;
    travelDurationInMinutes: number;
    instruction: string;
    previousSteps: TravelStep[];
    nextSteps: TravelStep[];
}

export interface RouteSegment {
    traveldKm: number;
    time: number;
    points: [number, number][];
}

export interface BloodhoundRouteResult {
    coordinates: number[][];
    segments: RouteSegment[];
    travelSteps: TravelStep[];
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
