import { createPact } from "@datadogs/core";

export interface ChargingQuery {
    lat: string;
    lng: string;
    radius?: string;
}

export const ChargingQueryPact = createPact<ChargingQuery>(
    "ChargingQueryProvider",
    { fromSourceType: "ChargingQuery" }
);
