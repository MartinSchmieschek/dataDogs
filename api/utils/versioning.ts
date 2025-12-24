import { IStore } from '../../store/IStore';

/**
 * Extrahiert die Basis-ID aus einer Version-ID
 * z.B. "seed-serialized-1-v2" -> "seed-serialized-1"
 */
export function extractBaseId(id: string): string {
    const match = id.match(/^(.+)-v(\d+)$/);
    return match ? match[1] : id;
}

/**
 * Findet die nächste Versionsnummer für eine Basis-ID
 * @param baseId - Die Basis-ID (ohne Versionsnummer)
 * @param store - Der Store für Datenbankzugriffe
 * @param entityType - Der Entity-Typ (z.B. SerializedDog.name)
 * @returns Die nächste Versions-ID (z.B. "seed-serialized-1-v2")
 */
export async function getNextVersionId(baseId: string, store: IStore, entityType: string): Promise<string> {
    const allEntities = await store.findByType(entityType);
    
    // Finde alle Versionen dieser Basis-ID
    const versions = allEntities
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
 * Prüft, ob eine ID eine Versions-ID ist (enthält -v\d+)
 */
export function isVersionedId(id: string): boolean {
    return /-v\d+$/.test(id);
}

