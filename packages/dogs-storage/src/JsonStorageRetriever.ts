/**
 * ============================================================
 *  JSON STORAGE RETRIEVER — der Archivar des Voids
 * ============================================================
 *  Arr, dieser Hund hütet eine eigene SQLite-Truhe und reicht seinen
 *  Geschwistern (SerializedDogs) vier Werkzeuge in die VM:
 *    jsonStore.get(key)
 *    jsonStore.set(key, value)
 *    jsonStore.delete(key)
 *    jsonStore.list()
 *  Über `getVmContextContributions()` werden die Methoden direkt als
 *  Globals in die Kinder geschrieben — so können andere Hunde permanent
 *  JSON-Werte ablegen und zurückholen, ohne HTTP zu sprechen.
 *
 *  Der Hund selbst liefert als Plunder einen schlanken Snapshot
 *  (Keys + Anzahl), damit auch Nicht-VM-Konsumenten Kontext haben.
 * ============================================================
 */

import { Dog, IHuntingDog, IHuntingSeason, getBaseDogIcon } from "@datadogs/core";
import type { IJsonStorage } from "./IJsonStorage";

export interface JsonStorageSnapshot {
    keys: string[];
    count: number;
}

export class JsonStorageRetriever extends Dog<JsonStorageSnapshot> {
    private static service: IJsonStorage | undefined;

    /** Vom Server (main.ts) vor der Hunde-Schmiede einmal gerufen. */
    static initService(service: IJsonStorage): void {
        JsonStorageRetriever.service = service;
    }

    constructor() {
        super();
        if (!JsonStorageRetriever.service) {
            throw new Error(
                "JsonStorageRetriever: service not initialised — JsonStorageRetriever.initService(service) muss vor `new JsonStorageRetriever()` aufgerufen werden.",
            );
        }
    }

    get name(): string {
        return JsonStorageRetriever.name;
    }

    get description(): string {
        return "Eigene SQLite-Ablage fuer JSON-Werte. Liefert jsonStore.get/set/delete/list als VM-Globals an SerializedDog-Children.";
    }

    get icon(): string | undefined {
        return getBaseDogIcon(JsonStorageRetriever.name);
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        return [];
    }

    protected yieldCollectorFactory = async (_season: IHuntingSeason): Promise<JsonStorageSnapshot> => {
        const service = JsonStorageRetriever.service!;
        const keys = await service.list();
        return { keys, count: keys.length };
    };

    /**
     * Werkzeuge fuer die Kinder: die gebundenen Service-Methoden landen als
     * globales `jsonStore`-Objekt im VM-Kontext jeder SerializedDog, die diesen
     * Hund als Parent deklariert.
     */
    getVmContextContributions(): Record<string, any> {
        const service = JsonStorageRetriever.service!;
        return {
            jsonStore: {
                get: service.get.bind(service),
                set: service.set.bind(service),
                delete: service.delete.bind(service),
                has: service.has.bind(service),
                list: service.list.bind(service),
                snapshot: service.snapshot.bind(service),
            },
        };
    }
}
