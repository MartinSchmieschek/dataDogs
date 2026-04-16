import { createPact } from "@datadogs/core";

export interface NoiseQuery {
    lat: string;
    lng: string;
    radius?: string;
}

export const NoiseQueryPact = createPact<NoiseQuery>(
    "NoiseQueryProvider",
    { fromSourceType: "NoiseQuery" }
);
