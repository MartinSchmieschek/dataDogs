import { createPact } from "@datadogs/core";

export interface DrinkingWaterQuery {
    lat: string;
    lng: string;
    radius?: string;
}

export const DrinkingWaterQueryPact = createPact<DrinkingWaterQuery>(
    "DrinkingWaterQueryProvider",
    { fromSourceType: "DrinkingWaterQuery" }
);
