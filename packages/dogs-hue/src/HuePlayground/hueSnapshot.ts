import { api } from "node-hue-api";
import type { HuePlaygroundLightEntry, HuePlaygroundSnapshot } from "./types";
import { wrapHueApiError } from "./hueBridgeErrors";

function mapLight(raw: unknown): HuePlaygroundLightEntry {
    const L = raw as {
        id?: string | number;
        name?: string;
        uniqueid?: string;
        state?: { on?: boolean; bri?: number };
    };
    const state = L.state;
    const bri = state?.bri;
    return {
        id: L.id ?? "",
        name: String(L.name ?? ""),
        on: Boolean(state?.on),
        bri: typeof bri === "number" ? bri : null,
        ...(L.uniqueid !== undefined ? { uniqueid: L.uniqueid } : {}),
    };
}

/**
 * Liest alle Lampen von der lokalen Hue-Bridge (HTTPS, node-hue-api v5).
 */
export async function fetchHueBridgeSnapshot(
    bridgeHost: string,
    bridgeUser: string
): Promise<HuePlaygroundSnapshot> {
    const trimmedHost = bridgeHost.trim();
    const trimmedUser = bridgeUser.trim();
    if (!trimmedHost) {
        throw new Error("HuePlaygroundRetriever: bridgehost fehlt oder ist leer");
    }
    if (!trimmedUser) {
        throw new Error("HuePlaygroundRetriever: bridgeuser fehlt oder ist leer");
    }

    try {
        const hueApi = await api.createLocal(trimmedHost).connect(trimmedUser);
        const allLights = await hueApi.lights.getAll();
        const lights = allLights.map(mapLight);
        return { bridgeHost: trimmedHost, lights };
    } catch (e: unknown) {
        throw wrapHueApiError(e, "HuePlaygroundRetriever (Snapshot)", trimmedHost);
    }
}
