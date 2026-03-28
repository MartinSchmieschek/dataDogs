import { ApiError } from "node-hue-api";

/** node-hue-api wirft bei HTTP-Fehlern oft HttpError (nicht exportiert) mit .status / .url. */
export function isHueHttpError(e: unknown): e is Error & { status: number; url?: string } {
    return e instanceof Error && typeof (e as { status?: unknown }).status === "number";
}

/**
 * Einheitliche, lesbare Fehler für Hue-Bridge (HTTP, ApiError, Netzwerk).
 */
export function wrapHueApiError(e: unknown, context: string, bridgeHost?: string): Error {
    const hostHint = bridgeHost ? ` [${bridgeHost}]` : "";

    if (isHueHttpError(e)) {
        const st = e.status;
        if (st === 429) {
            return new Error(
                `${context}: Bridge meldet HTTP 429 (Rate-Limit)${hostHint}. Kurz warten, Kennel-Runs entzerren oder weniger Hue-Aufrufe hintereinander.`
            );
        }
        if (st === 401 || st === 403) {
            return new Error(
                `${context}: HTTP ${st} — API-User ungültig oder keine Berechtigung${hostHint}.`
            );
        }
        if (st === 404) {
            return new Error(
                `${context}: HTTP 404 — Endpoint nicht gefunden (falsche Bridge-IP oder kein Hue-API)?${hostHint}`
            );
        }
        if (st >= 500) {
            return new Error(`${context}: Bridge-Serverfehler HTTP ${st}${hostHint}: ${e.message}`);
        }
        const data = (e as unknown as { data?: unknown }).data;
        const bodyHint =
            typeof data === "string" && data.includes("no lighting")
                ? " (Bridge antwortet mit HTML-Fehlerseite — oft Rate-Limit oder falsche URL)"
                : "";
        return new Error(`${context}: HTTP ${st}${hostHint}: ${e.message}${bodyHint}`);
    }

    if (e instanceof ApiError) {
        return new Error(`${context}: Hue API${hostHint}: ${e.message}`);
    }

    if (e instanceof Error) {
        const msg = e.message;
        // Bereits einmal formatiert (z. B. doppelter catch) — nicht erneut einpacken
        if (/Bridge meldet HTTP \d+/.test(msg)) {
            return e;
        }
        if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|certificate|TLS|SSL/i.test(msg)) {
            return new Error(`${context}: Netzwerk/TLS${hostHint}: ${msg}`);
        }
        return new Error(`${context}${hostHint}: ${msg}`);
    }

    return new Error(`${context}${hostHint}: ${String(e)}`);
}
