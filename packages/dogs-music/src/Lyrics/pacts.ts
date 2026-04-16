import { createPact } from "@datadogs/core";

export interface LyricsQuery {
    /** Kuenstler-Name */
    artist: string;
    /** Song-Titel */
    title: string;
}

export const LyricsQueryPact = createPact<LyricsQuery>(
    "LyricsQueryProvider",
    { fromSourceType: "LyricsQuery" }
);
