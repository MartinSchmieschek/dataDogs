import { createPact } from "datadogs";

/** Query-Parameter für BloodhoundRouteRetriever (QueryRetriever liefert lowercase-Keys). */
export interface BloodhoundRouteQuery {
    startlat: string;
    startlng: string;
    endlat: string;
    endlng: string;
    profile?: string;
}

export interface BloodhoundIsochroneInput {
    lat: string;
    lng: string;
    profile?: string;
    range: string;
}

export const BloodhoundRouteQueryPact = createPact<BloodhoundRouteQuery>(
    "BloodhoundQueryProvider",
    { fromSourceType: "BloodhoundRouteQuery" }
);

export const BloodhoundIsochronePact = createPact<BloodhoundIsochroneInput>(
    "BloodhoundIsochroneProvider",
    { fromSourceType: "BloodhoundIsochroneInput" }
);
