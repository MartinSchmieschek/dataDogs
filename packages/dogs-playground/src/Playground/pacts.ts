import { createPact } from "@datadogs/core";

export interface PlaygroundQuery {
    lat: string;
    lng: string;
    radius?: string;
}

export const PlaygroundQueryPact = createPact<PlaygroundQuery>(
    "PlaygroundQueryProvider",
    { fromSourceType: "PlaygroundQuery" }
);
