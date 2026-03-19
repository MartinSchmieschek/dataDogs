/** Minimale Typen für OpenRouteService-Directions-JSON (nur genutzte Felder). */
export interface OpenRouteServiceResponse {
    features: [
        {
            geometry: { coordinates: number[][] };
            properties: {
                segments: Array<{
                    steps: Array<{
                        way_points: number[];
                        distance: number;
                        duration: number;
                        instruction: string;
                    }>;
                }>;
            };
        }
    ];
}

/** Minimale Typen für Isochronen-JSON (nur genutzte Felder). */
export interface IsochroneResponse {
    features: Array<{
        geometry: { coordinates: number[][][] };
        properties: { value: number; center: number[] };
    }>;
}
