export interface OpenRouteServiceResponse {
    type: string;
    features: Feature[];
    bbox: number[];
    metadata: Metadata;
}

export interface Feature {
    type: string;
    properties: Properties;
    geometry: Geometry;
}

export interface Properties {
    segments: Segment[];
    summary: Summary;
    way_points: number[];
}

export interface Segment {
    distance: number;
    duration: number;
    steps: Step[];
}

export interface Step {
    distance: number;
    duration: number;
    type: number;
    instruction: string;
    name: string;
    way_points: number[];
}

export interface Summary {
    distance: number;
    duration: number;
}

export interface Geometry {
    type: string;
    coordinates: number[][];
}

export interface Metadata {
    attribution: string;
    service: string;
    timestamp: number;
    query: Query;
    engine: Engine;
}

export interface Query {
    coordinates: number[][];
    profile: string;
    format: string;
}

export interface Engine {
    version: string;
    build_date: string;
    graph_date: string;
}

export interface IsochroneResponse {
    type: string;
    features: IsochroneFeature[];
    bbox?: number[];
    metadata?: Metadata;
}

export interface IsochroneFeature {
    type: string;
    properties: IsochroneProperties;
    geometry: IsochroneGeometry;
}

export interface IsochroneProperties {
    group_index: number;
    value: number;
    center: number[];
}

export interface IsochroneGeometry {
    type: string;
    coordinates: number[][][];
}
