import { createPact } from "datadogs";

export interface IIsochroneInput {
    lat: number;
    lng: number;
    profile: string;
    range: number;
}

export interface IRouteInput {
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
    profile: string;
}

export const IsochroneInputPact = createPact<IIsochroneInput>('IsochroneInputProvider');
export const RouteInputPact = createPact<IRouteInput>('RouteInputProvider');
