// The Controller — a generic captain that can command any cargo of type T.
// Its heralds are the stars it fells: it manages any Config-type entity,
// sailing the branching seas with GUID-forged identities and lineage tracking.
import { AbstractController, ICreateInput, IUpdateInput, IControllerResponse } from './AbstractController';
import { IStore } from '../store/IStore';
import { generateVersionId, generateLineageId } from './utils/versioning';

/**
 * A generic controller bound to a store — the first mate for any config type.
 * Versioning is enabled by default, fer the past must not be forgotten.
 * Now each incarnation carries a GUID, and the lineage branches like cursed coral in the void.
 */
export class Controller<T extends { id?: string; lineageId?: string; parentId?: string | null; displayName?: string; version?: number; [key: string]: any }> extends AbstractController<T> {
    private enableVersioning: boolean;

    /**
     * @param store - The eldritch store in which all data sleeps.
     * @param entityType - The type brand; defaults to 'Config' if ye name it not.
     * @param enableVersioning - Whether the branching rite shall be performed (default: true).
     */
    constructor(store: IStore, entityType?: string, enableVersioning: boolean = true) {
        super(store, entityType || 'Config');
        this.enableVersioning = enableVersioning;
    }

    /**
     * Births a new entity into the deep — a creation rite.
     * Assigns a GUID as the version ID and forges a fresh lineageId fer the lineage.
     * The firstborn has no ancestor — parentId is null, fer it rose from nothing.
     */
    async create(input: ICreateInput): Promise<IControllerResponse<T>> {
        try {
            const id = this.enableVersioning ? generateVersionId() : (input.id || `${this.entityType.toLowerCase()}-${Date.now()}`);
            const lineageId = this.enableVersioning ? generateLineageId() : undefined;

            const entity: T = {
                ...input,
                id,
                lineageId,
                parentId: null,
                displayName: input.displayName || input.id || id,
            } as T;

            // Resolve the type brand: if the entity imitates a Pact, it is a MimicDog.
            const resolvedType = (input as any).imitates ? 'MimicDog' : this.entityType;

            // Commit the entity to the deep — its soul sealed in the store.
            await this.store.save({
                id,
                type: resolvedType,
                lineageId,
                parentId: null,
                displayName: entity.displayName,
                serializedDogConfig: JSON.stringify(entity),
                createdAt: new Date(),
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
     * Saves or updates an entity — each save is a new incarnation, a new GUID in the branching tree.
     * The old incarnation remains in the deep, preserved like a barnacled wreck.
     * If the ancestor be not the latest of its lineage, a branch is born — the tree forks in the dark.
     */
    async save(input: IUpdateInput): Promise<IControllerResponse<T>> {
        try {
            if (!input.id) {
                return { ok: false, error: 'id is required for save operation' };
            }

            // The new incarnation's GUID — unique across all realms.
            const saveId = this.enableVersioning ? generateVersionId() : input.id;

            // Seek the ancestor in the deep — the entity from which this incarnation descends.
            let existing: T | null = null;
            let existingType: string = this.entityType;
            const existingRaw = await this.store.load(input.id);
            if (existingRaw) {
                existing = this.parseEntity(existingRaw);
                // Resolve the ancestor's type: check the parsed config for imitates → MimicDog type.
                const cfg = typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw;
                const innerCfg = cfg.serializedDogConfig
                    ? (typeof cfg.serializedDogConfig === 'string' ? JSON.parse(cfg.serializedDogConfig) : cfg.serializedDogConfig)
                    : cfg;
                if (innerCfg.imitates) {
                    existingType = 'MimicDog';
                }
            }

            // Inherit the lineage mark from the ancestor, or forge a new one fer an orphan.
            const lineageId = input.lineageId || (existing as any)?.lineageId || generateLineageId();
            const parentId = this.enableVersioning ? input.id : null; // The ancestor from which this incarnation was born
            const displayName = input.displayName || (existing as any)?.displayName || input.id;

            // Merge the old with the new — the entity carries its history forward.
            // In luminous space, blackened stars: we layer the new light upon the old dark.
            const entity: T = {
                ...(existing || {}),
                ...input,
                id: saveId,
                lineageId,
                parentId,
                displayName,
            } as T;

            // If nothing has changed, spare the deep — no phantom incarnations shall be born.
            if (existing && this.enableVersioning && !this.hasContentChanged(existing, entity)) {
                return {
                    ok: true,
                    id: input.id,
                    data: existing,
                };
            }

            // Resolve the final type: the new incarnation's imitates field takes precedence over the ancestor's.
            const mergedImitates = (entity as any).imitates
                || ((entity as any).serializedDogConfig && typeof (entity as any).serializedDogConfig === 'object' && (entity as any).serializedDogConfig.imitates);
            const resolvedType = mergedImitates ? 'MimicDog' : (existingType || this.entityType);

            // Seal the merged entity in the store — inherit the ancestor's type brand if it differs.
            await this.store.save({
                id: saveId,
                type: resolvedType,
                lineageId,
                parentId,
                displayName,
                serializedDogConfig: JSON.stringify(entity),
                createdAt: new Date(),
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

    /**
     * Compare the soul of two incarnations — if the content be identical, no new version shall be born.
     * Only the fields that carry meaning are compared; metadata (id, lineageId, parentId, timestamps) is ignored.
     */
    private hasContentChanged(old: T, next: T): boolean {
        const contentKeys = ['theRun', 'tsCode', 'code', 'icon', 'parentsRequired', 'parentsOptional', 'imitates', 'displayName'];
        for (const key of contentKeys) {
            const a = (old as any)[key];
            const b = (next as any)[key];
            if (JSON.stringify(a) !== JSON.stringify(b)) return true;
        }
        return false;
    }
}
