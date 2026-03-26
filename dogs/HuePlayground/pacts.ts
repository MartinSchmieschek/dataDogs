import { createPact } from "datadogs";

/**
 * Pflicht-Input für HuePlaygroundRetriever (QueryRetriever/Mimic: lowercase-Keys: bridgehost, bridgeuser).
 * Alternativ: HueBridgeEnvRetriever liefert dieselben Keys aus HUE_BRIDGE_HOST / HUE_BRIDGE_USER (.env).
 */
export interface HueBridgeQueryInput {
    bridgehost: string;
    /** Hue-API-Username (von der Bridge ausgestellt). */
    bridgeuser: string;
}

export const HueBridgeQueryPact = createPact<HueBridgeQueryInput>(
    "HueBridgeQueryProvider",
    { fromSourceType: "HueBridgeQueryInput" }
);
