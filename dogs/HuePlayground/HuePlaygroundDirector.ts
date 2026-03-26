import { api } from "node-hue-api";
import type { HuePlaygroundLightEntry } from "./types";
import { fetchHueBridgeSnapshot } from "./hueSnapshot";
import { wrapHueApiError } from "./hueBridgeErrors";

/** node-hue-api Bridge-Client (lazy). */
type HueApiClient = Awaited<ReturnType<ReturnType<typeof api.createLocal>["connect"]>>;

function parseInterCommandDelayMs(): number {
    const raw = process.env.HUE_INTER_COMMAND_DELAY_MS;
    if (raw === undefined || raw === "") {
        return 120;
    }
    const n = parseInt(String(raw), 10);
    return Number.isFinite(n) && n >= 0 ? n : 120;
}

/**
 * Wie Kubrow: Snapshot-Daten + Methoden zum Arbeiten damit.
 * Schreibzugriffe gehen an die Hue-Bridge (Nebenwirkungen); nach erfolgreichen Aufrufen wird der lokale Cache aktualisiert.
 *
 * **Puffer:** Alle Bridge-Aufrufe (refresh, setOn, …) laufen **seriell**; nach jedem abgeschlossenen Schritt folgt eine Pause
 * (`HUE_INTER_COMMAND_DELAY_MS`, Standard 120 ms), um HTTP-429 (Rate-Limit) zu vermeiden.
 */
export class HuePlaygroundDirector {
    /** Aktueller Lampen-Cache (nach refresh/set* angepasst). */
    lights: HuePlaygroundLightEntry[];

    private _api: HueApiClient | null = null;

    /** Pause in ms nach jedem fertigen Hue-Aufruf (vor dem nächsten in der Queue). */
    private readonly interCommandDelayMs: number;

    /** FIFO: wartende Hue-Operationen; immer nur eine gleichzeitig. */
    private queueTail: Promise<void> = Promise.resolve();

    constructor(
        readonly bridgeHost: string,
        private readonly bridgeUser: string,
        lights: HuePlaygroundLightEntry[]
    ) {
        this.lights = [...lights];
        this.interCommandDelayMs = parseInterCommandDelayMs();
    }

    /**
     * Führt `fn` nach der aktuellen Queue ab; nach Abschluss optional Pause, dann nächster Job.
     */
    private enqueueHue<T>(fn: () => Promise<T>): Promise<T> {
        const run = this.queueTail.then(() => fn());
        this.queueTail = run.then(
            async () => {
                if (this.interCommandDelayMs > 0) {
                    await new Promise<void>((r) => setTimeout(r, this.interCommandDelayMs));
                }
            },
            () => undefined
        );
        return run;
    }

    /** Nur bridgeHost + lights — keine Credentials, keine Methoden (für JSON/API). */
    toJSON(): { bridgeHost: string; lights: HuePlaygroundLightEntry[] } {
        return { bridgeHost: this.bridgeHost, lights: this.lights };
    }

    /** Kein eigenes wrapHueApiError — Aufrufer (setOn/setState/…) wickeln einmal ein. */
    private async ensureApi(): Promise<HueApiClient> {
        if (!this._api) {
            this._api = await api.createLocal(this.bridgeHost.trim()).connect(this.bridgeUser.trim());
        }
        return this._api;
    }

    /** Alle Lampen neu von der Bridge laden; überschreibt `lights`. */
    async refresh(): Promise<void> {
        const snap = await fetchHueBridgeSnapshot(this.bridgeHost, this.bridgeUser);
        this.lights = [...snap.lights];
    }

    getById(id: number | string): HuePlaygroundLightEntry | undefined {
        const s = String(id);
        return this.lights.find((l) => String(l.id) === s);
    }

    findByName(nameSubstring: string): HuePlaygroundLightEntry | undefined {
        const lower = nameSubstring.toLowerCase();
        return this.lights.find((l) => l.name.toLowerCase().includes(lower));
    }

    /**
     * Lampe ein- oder ausschalten.
     */
    async setOn(id: number | string, on: boolean): Promise<void> {
        return this.enqueueHue(async () => {
            try {
                const hueApi = await this.ensureApi();
                await hueApi.lights.setLightState(id, { on });
                this.patchLocal(id, { on, ...(on ? {} : { bri: null }) });
            } catch (e: unknown) {
                throw wrapHueApiError(e, `HuePlaygroundDirector.setOn(${id})`, this.bridgeHost);
            }
        });
    }

    /**
     * Helligkeit 1–254 (Hue). Schaltet die Lampe dabei ein.
     */
    async setBrightness(id: number | string, bri: number): Promise<void> {
        return this.enqueueHue(async () => {
            try {
                const clamped = Math.min(254, Math.max(1, Math.round(bri)));
                const hueApi = await this.ensureApi();
                await hueApi.lights.setLightState(id, { on: true, bri: clamped });
                this.patchLocal(id, { on: true, bri: clamped });
            } catch (e: unknown) {
                throw wrapHueApiError(e, `HuePlaygroundDirector.setBrightness(${id})`, this.bridgeHost);
            }
        });
    }

    /** Aktuellen Zustand invertieren (laut Cache; wenn unbekannt, kurz refreshen). */
    async toggle(id: number | string): Promise<void> {
        let current = this.getById(id);
        if (!current) {
            await this.refresh();
            current = this.getById(id);
        }
        if (!current) {
            throw new Error(`HuePlaygroundDirector: keine Lampe mit id ${id}`);
        }
        await this.setOn(id, !current.on);
    }

    /**
     * Freies Setzen von Hue-Light-State-Feldern (z. B. nur `on`, oder `on` + `bri`).
     */
    async setState(
        id: number | string,
        state: { on?: boolean; bri?: number }
    ): Promise<void> {
        return this.enqueueHue(async () => {
            try {
                const hueApi = await this.ensureApi();
                const body: Record<string, unknown> = {};
                if (state.on !== undefined) body.on = state.on;
                if (state.bri !== undefined) {
                    body.bri = Math.min(254, Math.max(1, Math.round(state.bri)));
                }
                await hueApi.lights.setLightState(id, body);
                const patch: Partial<Pick<HuePlaygroundLightEntry, "on" | "bri">> = {};
                if (state.on !== undefined) patch.on = state.on;
                if (state.bri !== undefined) patch.bri = state.bri;
                if (state.on === false) patch.bri = null;
                this.patchLocal(id, patch);
            } catch (e: unknown) {
                throw wrapHueApiError(e, `HuePlaygroundDirector.setState(${id})`, this.bridgeHost);
            }
        });
    }

    private patchLocal(
        id: number | string,
        patch: Partial<Pick<HuePlaygroundLightEntry, "on" | "bri">>
    ): void {
        const s = String(id);
        const idx = this.lights.findIndex((l) => String(l.id) === s);
        if (idx < 0) {
            return;
        }
        this.lights[idx] = { ...this.lights[idx], ...patch };
    }
}
