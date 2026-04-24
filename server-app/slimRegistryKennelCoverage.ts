import { BASE_DOG_PREFIX } from '@datadogs/core';
import type { IStore } from '../store/IStore';

function parseDogIdsFromKennelRow(row: any): string[] {
    const raw = row?.dogIds;
    if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string');
    if (typeof raw === 'string') {
        try {
            const p = JSON.parse(raw);
            return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : [];
        } catch {
            return [];
        }
    }
    if (row?.serializedDogConfig) {
        try {
            const cfg =
                typeof row.serializedDogConfig === 'string'
                    ? JSON.parse(row.serializedDogConfig)
                    : row.serializedDogConfig;
            const ids = cfg?.dogIds;
            return Array.isArray(ids) ? ids.filter((x: unknown): x is string => typeof x === 'string') : [];
        } catch {
            return [];
        }
    }
    return [];
}

/** Alle `base:…`-Kurznamen aus den jeweils neuesten Kennel-Versionen (pro Lineage). */
export async function collectBaseDogNamesFromLatestKennels(kennelsStore: IStore): Promise<Set<string>> {
    const rows = await kennelsStore.findLatestVersionsByType('KennelConfig');
    const names = new Set<string>();
    for (const row of rows) {
        for (const id of parseDogIdsFromKennelRow(row)) {
            if (id.startsWith(BASE_DOG_PREFIX)) {
                names.add(id.slice(BASE_DOG_PREFIX.length));
            }
        }
    }
    return names;
}

/**
 * Wirft, wenn ein Kennel in der DB einen Base-Dog referenziert, der in der schlanken Registry fehlt.
 * So bleibt RAM minimal, ohne bestehende Kennel-Manifeste still zu brechen.
 */
export function assertSlimRegistryCoversKennelDbRefs(
    requiredDogNames: Set<string>,
    baseDogsMap: Map<string, unknown>,
    envLabel: string,
): void {
    const missing = [...requiredDogNames].filter((n) => !baseDogsMap.has(n)).sort();
    if (missing.length === 0) return;
    throw new Error(
        `[${envLabel}] Schlanke Base-Dog-Registry deckt Kennels in der DB nicht. Fehlend im baseDogsMap: ${missing.join(', ')}. ` +
            'Ergänze server-registries/slimDeployRegistry.ts (Klassen + ggf. Pacts) oder entferne die Referenz aus dem Kennel.',
    );
}
