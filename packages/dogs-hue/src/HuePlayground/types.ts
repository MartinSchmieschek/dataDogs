/**
 * Read-only Snapshot der Hue-Bridge (Illumination-Ansatz, ohne LightVolume-Simulation).
 * Entspricht dem Geist von HuePlayground-Experiment: Lampen als erleuchtbare Entitäten.
 */
export interface HuePlaygroundLightEntry {
    id: number | string;
    name: string;
    on: boolean;
    bri: number | null;
    uniqueid?: string;
}

export interface HuePlaygroundSnapshot {
    bridgeHost: string;
    lights: HuePlaygroundLightEntry[];
}
