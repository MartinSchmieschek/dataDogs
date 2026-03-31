// The Controller — a generic captain that can command any cargo of type T.
// Its heralds are the stars it fells: it manages any Config-type entity,
// sailing the versioned seas with automatic ID generation and version tracking.
import { AbstractController, ICreateInput, IUpdateInput, IControllerResponse } from './AbstractController';
import { IStore } from '../store/IStore';
import { extractBaseId, getNextVersionId, isVersionedId } from './utils/versioning';

/**
 * A generic controller bound to a store — the first mate for any config type.
 * Versioning is enabled by default, for the past must not be forgotten.
 * Through endless faces, countless forms, a multitude unfolds — versioning tracks every one.
 */
export class Controller<T extends { id?: string; version?: number; [key: string]: any }> extends AbstractController<T> {
    private enableVersioning: boolean;

    /**
     * @param store - The eldritch store in which all data sleeps.
     * @param entityType - The type brand; defaults to 'Config' if ye name it not.
     * @param enableVersioning - Whether the versioning rite shall be performed (default: true).
     */
    constructor(store: IStore, entityType?: string, enableVersioning: boolean = true) {
        super(store, entityType || 'Config');
        this.enableVersioning = enableVersioning;
    }

    /**
     * Births a new entity into the deep — a creation rite.
     * Assigns an auto-generated ID if none is given.
     * If versioning is enabled, the first life is branded -v1.
     * Roiling, moaning: this realm of ours, where new dogs rise from nothing.
     */
    async create(input: ICreateInput): Promise<IControllerResponse<T>> {
        try {
            let id = input.id || `${this.entityType.toLowerCase()}-${Date.now()}`;

            // If the ID bears no version mark, brand it with -v1 to begin the lineage.
            if (this.enableVersioning && !isVersionedId(id)) {
                id = `${id}-v1`;
            }

            const entity: T = {
                ...input,
                id,
                version: this.enableVersioning ? 1 : undefined
            } as T;

            // Commit the entity to the deep — its soul sealed in the store.
            await this.store.save({
                id,
                type: this.entityType,
                serializedDogConfig: JSON.stringify(entity)
            });

            return {
                ok: true,
                id,
                data: entity
            };
        } catch (error) {
            return { ok: false, error: String(error) };
        }
    }

    /**
     * Saves or updates an entity — each save is a new life, a new version.
     * The old version remains in the deep, preserved like a barnacled wreck.
     * If versioning is on, the next version ID is calculated from what already lurks below.
     */
    async save(input: IUpdateInput): Promise<IControllerResponse<T>> {
        try {
            if (!input.id) {
                return { ok: false, error: 'id is required for save operation' };
            }

            let saveId = input.id;
            let version = input.version;

            // Calculate the next version ID — the entity earns another life.
            if (this.enableVersioning) {
                const baseId = extractBaseId(input.id);
                const nextVersionId = await getNextVersionId(baseId, this.store, this.entityType);
                saveId = nextVersionId;

                // Extract the version number from the new ID — read the brand.
                const versionMatch = nextVersionId.match(/-v(\d+)$/);
                version = versionMatch ? parseInt(versionMatch[1], 10) : 1;
            }

            // Seek the existing entity to merge with — we do not discard what came before.
            let existing: T | null = null;
            if (this.enableVersioning) {
                const existingData = await this.store.load(input.id);
                if (existingData) {
                    existing = this.parseEntity(existingData);
                } else {
                    // The exact ID was not found — seek the newest version that still breathes.
                    const baseId = extractBaseId(input.id);
                    const allVersions = await this.store.findByType(this.entityType);
                    const matchingVersions = allVersions.filter((v: any) => {
                        const vBaseId = extractBaseId(v.id);
                        return vBaseId === baseId;
                    });

                    if (matchingVersions.length > 0) {
                        // Sort by version — the strongest (newest) rises to the top.
                        matchingVersions.sort((a: any, b: any) => {
                            const aData = typeof a.serializedDogConfig === 'string'
                                ? JSON.parse(a.serializedDogConfig)
                                : a.serializedDogConfig;
                            const bData = typeof b.serializedDogConfig === 'string'
                                ? JSON.parse(b.serializedDogConfig)
                                : b.serializedDogConfig;
                            return (bData.version || 0) - (aData.version || 0);
                        });
                        existing = this.parseEntity(matchingVersions[0].serializedDogConfig || matchingVersions[0]);
                    }
                }
            } else {
                // No versioning — load directly and overwrite without ceremony.
                const existingData = await this.store.load(input.id);
                if (existingData) {
                    existing = this.parseEntity(existingData);
                }
            }

            // Merge the old with the new — the entity carries its history forward.
            // In luminous space, blackened stars: we layer the new light upon the old dark.
            const entity: T = {
                ...(existing || {}),
                ...input,
                id: saveId,
                version: version !== undefined ? version : (existing as any)?.version
            } as T;

            // Seal the merged entity in the store — a new version born.
            await this.store.save({
                id: saveId,
                type: this.entityType,
                serializedDogConfig: JSON.stringify(entity)
            });

            return {
                ok: true,
                id: saveId,
                data: entity
            };
        } catch (error) {
            return { ok: false, error: String(error) };
        }
    }
}

