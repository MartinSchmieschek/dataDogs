import { IStore } from '../../store/IStore';
import { SerializedDog, ISerializedDogConfig } from 'datadogs';

/**
 * Extrahiert die Basis-ID aus einer Version-ID
 * z.B. "seed-serialized-1-v2" -> "seed-serialized-1"
 */
export function extractBaseId(id: string): string {
    const match = id.match(/^(.+)-v\d+$/);
    return match ? match[1] : id;
}

/**
 * Findet die nächste Versionsnummer für eine Basis-ID
 * z.B. wenn "seed-serialized-1-v1" existiert, gibt "seed-serialized-1-v2" zurück
 */
export async function getNextVersionId(baseId: string, store: IStore): Promise<string> {
    const allNodes = await store.findByType(SerializedDog.name);
    
    // Finde alle Versionen dieser Basis-ID
    const versions = allNodes
        .map(n => n.id)
        .filter(id => {
            const match = id.match(/^(.+)-v(\d+)$/);
            return match && match[1] === baseId;
        })
        .map(id => {
            const match = id.match(/-v(\d+)$/);
            return match ? parseInt(match[1], 10) : 0;
        })
        .sort((a, b) => b - a); // Sortiere absteigend
    
    // Wenn keine Version existiert, starte mit v1
    if (versions.length === 0) {
        return `${baseId}-v1`;
    }
    
    // Nächste Versionsnummer ist die höchste + 1
    const nextVersion = versions[0] + 1;
    return `${baseId}-v${nextVersion}`;
}

/**
 * Erstellt eine ISerializedDogConfig aus einem Save-Input mit Versionsverwaltung
 */
export async function createNodeConfigFromSaveInput(
    input: { id: string; tsCode?: string; code?: string; parentsRequired?: string[]; parentsOptional?: string[]; serializedDogConfig?: ISerializedDogConfig },
    store: IStore
): Promise<{ config: ISerializedDogConfig; nextVersionId: string }> {
    const id = input.id;
    const tsCode = input.tsCode || input.code || '';
    const parentsRequired = input.parentsRequired || [];
    const parentsOptional = input.parentsOptional || [];
    const serializedDogConfig = input.serializedDogConfig;
    
    // Extrahiere Basis-ID (ohne Version)
    const baseId = extractBaseId(id);
    
    // Finde nächste Versionsnummer
    const nextVersionId = await getNextVersionId(baseId, store);
    const nextVersion = parseInt(nextVersionId.match(/-v(\d+)$/)?.[1] || '1', 10);
    
    // Wenn Config aus UI übergeben wurde, verwende diese
    let config: ISerializedDogConfig;
    if (serializedDogConfig) {
        config = {
            ...serializedDogConfig,
            theRun: tsCode,
            version: nextVersion,
            parentsRequired: parentsRequired || serializedDogConfig.parentsRequired || [],
            parentsOptional: parentsOptional || serializedDogConfig.parentsOptional || []
        };
    } else {
        // Lade existierenden Config - versuche zuerst aktuelle ID, dann suche nach neuester Version
        let existing = await store.load(id);
        
        // Wenn nicht gefunden, suche nach neuester Version dieser Basis-ID
        if (!existing) {
            const allVersions = await store.findByType(SerializedDog.name);
            const matchingVersions = allVersions.filter((v: any) => {
                const vBaseId = extractBaseId(v.id);
                return vBaseId === baseId;
            });
            
            if (matchingVersions.length > 0) {
                // Sortiere nach version aus Config
                matchingVersions.sort((a: any, b: any) => {
                    const aConfig = typeof a.serializedDogConfig === 'string' 
                        ? JSON.parse(a.serializedDogConfig) 
                        : a.serializedDogConfig;
                    const bConfig = typeof b.serializedDogConfig === 'string' 
                        ? JSON.parse(b.serializedDogConfig) 
                        : b.serializedDogConfig;
                    return (bConfig.version || 0) - (aConfig.version || 0);
                });
                existing = matchingVersions[0].serializedDogConfig;
            }
        }
        
        if (existing) {
            config = typeof existing === 'string' ? JSON.parse(existing) : existing;
        } else {
            config = { theRun: '', version: 1, parentsRequired: [], parentsOptional: [] };
        }

        // Update Config
        config.theRun = tsCode;
        config.version = nextVersion; // Setze Versionsnummer in Config
        // Immer aktualisieren, auch wenn leer
        config.parentsRequired = parentsRequired || [];
        config.parentsOptional = parentsOptional || [];
    }

    return { config, nextVersionId };
}

