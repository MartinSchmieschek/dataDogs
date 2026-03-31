// The AbstractController — the ancient pact that all controllers must honour.
// From brooding gulfs are we beheld: every CRUD operation flows through these eldritch methods.
import { IStore } from '../store/IStore';

/**
 * The base form of all entities that sail under our flag.
 * Corporeal laws are unwritten — the id is optional until creation bestows one.
 */
export interface IEntity {
    id?: string;
    [key: string]: any;
}

/**
 * The cargo manifest for create operations — what the caller must provide to birth a new entity.
 */
export interface ICreateInput {
    [key: string]: any;
}

/**
 * The cargo manifest for save/update operations.
 * The id must be named lest we lose the entity in the void.
 */
export interface IUpdateInput {
    id?: string;
    version?: number; // The version mark — how many lives this entity has lived.
    [key: string]: any;
}

/**
 * The sealed response from a controller operation.
 * ok signals whether we plundered successfully or were swallowed by the deep.
 */
export interface IControllerResponse<T = any> {
    ok: boolean;
    data?: T;
    error?: string;
    id?: string;
}

/**
 * The AbstractController — a skeletal captain that all concrete controllers must flesh out.
 * It enforces the pact: create and save must be implemented by every crew member.
 * To cosmic madness laws submit, though stalwart minds entreat — here the stalwart law holds firm.
 */
export abstract class AbstractController<T extends IEntity = IEntity> {
    protected store: IStore;
    protected entityType: string;

    /**
     * @param store - The store that guards the eldritch deep.
     * @param entityType - The type brand burned onto every entity this captain commands.
     */
    constructor(store: IStore, entityType: string) {
        this.store = store;
        this.entityType = entityType;
    }

    /**
     * Birth a new entity into existence — the creation rite.
     * @param input - The raw materials from which the entity shall be forged.
     * @returns The entity with its newly stamped ID, or an error from the void.
     */
    abstract create(input: ICreateInput): Promise<IControllerResponse<T>>;

    /**
     * Save or overwrite an entity in the deep — the preservation rite.
     * @param input - Must carry an id to locate what already lurks below.
     * @returns The saved entity, or an error if the deep refused.
     */
    abstract save(input: IUpdateInput): Promise<IControllerResponse<T>>;

    /**
     * Dredge a single entity by its ID from the eldritch store.
     * @param id - The name by which it is known in the deep.
     * @returns The entity if it lurks, null if the void consumed it.
     */
    async getById(id: string): Promise<IControllerResponse<T | null>> {
        try {
            const data = await this.store.load(id);
            if (!data) {
                return { ok: false, error: `Entity mit ID ${id} nicht gefunden`, data: null };
            }
            const parsed = this.parseEntity(data);
            return { ok: true, data: parsed };
        } catch (error) {
            return { ok: false, error: String(error), data: null };
        }
    }

    /**
     * Haul up the full manifest of entities of this type.
     * @param filter - Optional: pass a filter to narrow the net — only matching entities surface.
     * @returns The crew of entities, or an empty hold if none survive.
     */
    async list(filter?: Partial<T>): Promise<IControllerResponse<T[]>> {
        try {
            const results = await this.store.findByType(this.entityType);
            let entities = results.map((r: any) => {
                const parsed = this.parseEntity(r.serializedDogConfig || r);
                // Ensure the id from the store row is preserved — names must not be lost.
                if (r.id) {
                    parsed.id = r.id;
                }
                return parsed;
            });

            // Apply the filter if one was cast — only those who answer the challenge may board.
            if (filter) {
                entities = entities.filter((entity: T) => {
                    return Object.keys(filter).every(key => {
                        return entity[key] === filter[key];
                    });
                });
            }

            return { ok: true, data: entities };
        } catch (error) {
            return { ok: false, error: String(error), data: [] };
        }
    }

    /**
     * Cast the entity overboard — deleted, gone, swallowed by the void.
     * @param id - The mark of the condemned.
     * @returns ok: true if we sent it to its fate; an error if it fought back.
     */
    async delete(id: string): Promise<IControllerResponse<void>> {
        try {
            if (!id) {
                return { ok: false, error: 'id is required' };
            }
            await this.store.delete(id);
            return { ok: true };
        } catch (error) {
            return { ok: false, error: String(error) };
        }
    }

    /**
     * Peer into the deep and ask: does this entity still breathe?
     * @param id - The name to search for.
     * @returns true if it lurks, false if the void has swallowed it.
     */
    async exists(id: string): Promise<boolean> {
        try {
            const result = await this.getById(id);
            return result.ok && result.data !== null;
        } catch {
            return false;
        }
    }

    /**
     * Summon all versions of an entity — every life it has ever lived, newest first.
     * Through endless faces, countless forms, a multitude unfolds.
     */
    async getVersions(baseId: string): Promise<Array<{ id: string; version: number; config: any }>> {
        const versions = await this.store.findAllVersions(this.entityType, baseId);
        return versions.map(v => {
            let config: any = {};
            try {
                config = typeof v.serializedDogConfig === 'string'
                    ? JSON.parse(v.serializedDogConfig)
                    : v.serializedDogConfig;
            } catch { /* If the config has sunk, we return an empty chest. */ }
            return { id: v.id, version: v.version, config };
        });
    }

    /**
     * Parse a raw store payload into an entity of type T.
     * If the data be a string, it is unshackled from JSON; otherwise it sails as-is.
     */
    protected parseEntity(data: any): T {
        if (typeof data === 'string') {
            return JSON.parse(data) as T;
        }
        return data as T;
    }
}

