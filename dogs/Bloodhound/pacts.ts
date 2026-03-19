import { createPact } from "datadogs";

/** Query-Parameter für BloodhoundRouteRetriever (QueryRetriever liefert lowercase-Keys). */
export interface BloodhoundRouteQuery {
    startlat: string;
    startlng: string;
    endlat: string;
    endlng: string;
    profile?: string;
}

const BLOODHOUND_ROUTE_QUERY_TYPE_DEF = `
interface BloodhoundRouteQuery { startlat: string; startlng: string; endlat: string; endlng: string; profile?: string; }
type BloodhoundRouteQueryReturn = BloodhoundRouteQuery;
`;

export interface BloodhoundIsochroneInput {
    lat: string;
    lng: string;
    profile?: string;
    range: string;
}

const BLOODHOUND_ISOCHRONE_INPUT_TYPE_DEF = `
interface BloodhoundIsochroneInput { lat: string; lng: string; profile?: string; range: string; }
type BloodhoundIsochroneInputReturn = BloodhoundIsochroneInput;
`;

export const BloodhoundRouteQueryPact = createPact<BloodhoundRouteQuery>(
    "BloodhoundQueryProvider",
    BLOODHOUND_ROUTE_QUERY_TYPE_DEF
);

export const BloodhoundIsochronePact = createPact<BloodhoundIsochroneInput>(
    "BloodhoundIsochroneProvider",
    BLOODHOUND_ISOCHRONE_INPUT_TYPE_DEF
);
