import { createPact } from "@datadogs/core";

export interface OpenFoodQuery {
    lat: string;
    lng: string;
    radius?: string;
    cuisine?: string;
}

export const OpenFoodQueryPact = createPact<OpenFoodQuery>(
    "OpenFoodQueryProvider",
    { fromSourceType: "OpenFoodQuery" }
);
