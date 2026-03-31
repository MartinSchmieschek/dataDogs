// Versioning utilities — the rites by which entities earn new lives in the eldritch deep.
// To cosmic forms from tangent planes we end as we began:
// every entity starts at v1 and earns higher versions through each save.
import { IStore } from '../../store/IStore';

/**
 * Strips the version mark from an ID and returns the base name — the entity's true face.
 * e.g. "seed-serialized-1-v2" -> "seed-serialized-1"
 * In luminous space, blackened stars: the version is merely the light; the base ID is the star.
 */
export function extractBaseId(id: string): string {
    const match = id.match(/^(.+)-v(\d+)$/);
    return match ? match[1] : id;
}

/**
 * Determines the next version ID for a given base entity.
 * Queries the store for all existing versions, finds the highest, and returns the next.
 * If none exist, the lineage begins at -v1.
 * @param baseId - The base name of the entity, without a version suffix.
 * @param store - The eldritch store where past versions sleep.
 * @param entityType - The type brand of the entity (e.g. SerializedDog.name).
 * @returns The next version ID (e.g. "seed-serialized-1-v3").
 */
export async function getNextVersionId(baseId: string, store: IStore, entityType: string): Promise<string> {
    const allEntities = await store.findByType(entityType);

    // Gather all versions that share this base ID — every life the entity has ever lived.
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
        .sort((a, b) => b - a); // Highest version first — the mightiest rises to the top.

    // No versions yet — this entity begins its first life.
    if (versions.length === 0) {
        return `${baseId}-v1`;
    }

    // The next life is one higher than the greatest that has lived.
    const nextVersion = versions[0] + 1;
    return `${baseId}-v${nextVersion}`;
}

/**
 * Checks whether an ID carries the version brand — the -v\d+ mark of an entity with history.
 * Unversioned IDs are newborns; versioned IDs have lived and been saved before.
 */
export function isVersionedId(id: string): boolean {
    return /-v\d+$/.test(id);
}

