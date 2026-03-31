// The KennelController — keeper of the kennels, master of which hounds hunt together.
// To cosmic madness laws submit, though stalwart minds entreat:
// this controller governs the sacred groupings of dogs, the crews that sail as one.
import { AbstractController, ICreateInput, IUpdateInput, IControllerResponse } from './AbstractController';
import { IStore } from '../store/IStore';
import { IKennelConfig } from '@datadogs/core';

/**
 * Cargo manifest for raising a new kennel from the void.
 * All fields are optional — a kennel may begin as an empty hull.
 */
export interface ICreateKennelInput extends ICreateInput {
    id?: string;
    name?: string;
    description?: string;
    emoji?: string;
    dogIds?: string[];
}

/**
 * Cargo manifest for updating an existing kennel.
 * The id must be named — one cannot update what cannot be found in the deep.
 */
export interface ISaveKennelInput extends IUpdateInput {
    id: string;
    name?: string;
    description?: string;
    dogIds?: string[];
    defaultQuery?: Record<string, string>;
    defaultBody?: any;
}

/**
 * The KennelController — a specialised captain for IKennelConfig entities.
 * Manages the assembly of hounds into kennels and oversees their configuration.
 * Corporeal laws are unwritten: the kennel's dogIds live as JSON strings in the deep
 * and must be unshackled upon retrieval.
 */
export class KennelController extends AbstractController<IKennelConfig> {
    private readonly KENNEL_TYPE = 'KennelConfig';

    constructor(store: IStore) {
        super(store, 'KennelConfig');
    }

    /**
     * Raises a new kennel from the abyss — brands it with an ID and commits it to the store.
     * If no id is given, one is forged from the timestamp, like a grave-marker on the ocean floor.
     * We verify after saving that the kennel truly arrived — the void sometimes swallows things whole.
     */
    async create(input: ICreateKennelInput): Promise<IControllerResponse<IKennelConfig>> {
        try {
            const id = input.id || `kennel-${Date.now()}`;
            const config: IKennelConfig = {
                id,
                name: input.name || undefined,
                description: input.description || undefined,
                emoji: input.emoji?.trim() || undefined,
                dogIds: input.dogIds || [],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            console.log(`[KennelController.create] Erstelle neue Kennel-Config: ${id}`);
            console.log(`[KennelController.create] Config:`, JSON.stringify(config, null, 2));

            await this.store.save({
                id,
                type: this.KENNEL_TYPE,
                name: config.name,
                description: config.description,
                emoji: config.emoji,
                dogIds: config.dogIds,
                defaultQuery: config.defaultQuery ? JSON.stringify(config.defaultQuery) : undefined,
                defaultBody: config.defaultBody ? JSON.stringify(config.defaultBody) : undefined,
                createdAt: config.createdAt?.toISOString(),
                updatedAt: config.updatedAt?.toISOString()
            });

            // Verify the kennel was truly stored — trust nothing that has not been confirmed.
            const saved = await this.store.findByType(this.KENNEL_TYPE);
            const found = saved.find((n: any) => n.id === id);
            if (!found) {
                console.error(`[KennelController.create] FEHLER: Kennel-Config ${id} wurde nicht in DB gefunden nach dem Speichern!`);
                return { ok: false, error: 'Kennel-Config wurde nicht gespeichert' };
            }

            console.log(`[KennelController.create] Erfolgreich gespeichert: ${id}`);
            return {
                ok: true,
                id,
                data: config
            };
        } catch (error) {
            console.error('[KennelController.create] Fehler:', error);
            return { ok: false, error: String(error) };
        }
    }

    /**
     * Updates an existing kennel — merges the new cargo with whatever already sleeps in the deep.
     * Fields not provided in the input are inherited from the existing config.
     * The updatedAt is always refreshed — the kennel's last voyage is always recorded.
     */
    async save(input: ISaveKennelInput): Promise<IControllerResponse<IKennelConfig>> {
        try {
            if (!input.id) {
                return { ok: false, error: 'id is required' };
            }

            // Seek the existing kennel first — what slumbers below must not be lost.
            let existing: IKennelConfig | null = null;
            const existingData = await this.store.load(input.id);
            if (existingData) {
                existing = this.parseEntity(existingData);
            }

            // Merge new cargo with what was already in the hold.
            // An empty emoji string is treated as removal — the ship sails under no flag.
            const config: IKennelConfig = {
                id: input.id,
                name: input.name !== undefined ? input.name : (existing?.name || undefined),
                description: input.description !== undefined ? input.description : (existing?.description || undefined),
                emoji:
                    input.emoji !== undefined
                        ? (input.emoji.trim() === '' ? undefined : input.emoji.trim())
                        : (existing?.emoji || undefined),
                dogIds: input.dogIds !== undefined ? input.dogIds : (existing?.dogIds || []),
                defaultQuery: input.defaultQuery !== undefined ? input.defaultQuery : (existing?.defaultQuery || undefined),
                defaultBody: input.defaultBody !== undefined ? input.defaultBody : (existing?.defaultBody || undefined),
                createdAt: existing?.createdAt || new Date(),
                updatedAt: new Date()
            };

            console.log(`[KennelController.save] Speichere Kennel-Config: ${input.id}`);
            console.log(`[KennelController.save] Config:`, JSON.stringify(config, null, 2));

            await this.store.save({
                id: input.id,
                type: this.KENNEL_TYPE,
                name: config.name,
                description: config.description,
                emoji: config.emoji,
                dogIds: config.dogIds,
                defaultQuery: config.defaultQuery ? JSON.stringify(config.defaultQuery) : undefined,
                defaultBody: config.defaultBody ? JSON.stringify(config.defaultBody) : undefined,
                createdAt: config.createdAt?.toISOString(),
                updatedAt: config.updatedAt?.toISOString()
            });

            console.log(`[KennelController.save] Erfolgreich gespeichert: ${input.id}`);
            return {
                ok: true,
                id: input.id,
                data: config
            };
        } catch (error) {
            console.error('[KennelController.save] Fehler:', error);
            return { ok: false, error: String(error) };
        }
    }

    /**
     * Overrides getById — ensures parseEntity is called with the correct kennel payload.
     * KennelConfig rows do not carry serializedDogConfig as their primary form.
     */
    async getById(id: string): Promise<IControllerResponse<IKennelConfig | null>> {
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
     * Overrides list() — KennelConfig rows are parsed directly, not via serializedDogConfig.
     * Its heralds are the stars it fells: each kennel is returned in its full form.
     */
    async list(filter?: Partial<IKennelConfig>): Promise<IControllerResponse<IKennelConfig[]>> {
        try {
            const results = await this.store.findByType(this.entityType);
            let entities = results.map((r: any) => {
                // Kennels sail as raw rows — not wrapped in serializedDogConfig.
                const parsed = this.parseEntity(r);
                if (r.id) {
                    parsed.id = r.id;
                }
                return parsed;
            });

            // Apply the filter if cast — only matching kennels shall surface.
            if (filter) {
                entities = entities.filter((entity: IKennelConfig) => {
                    return Object.keys(filter).every(key => {
                        return entity[key as keyof IKennelConfig] === filter[key as keyof IKennelConfig];
                    });
                });
            }

            return { ok: true, data: entities };
        } catch (error) {
            return { ok: false, error: String(error), data: [] };
        }
    }

    /**
     * Parses a raw store payload into an IKennelConfig.
     * The dogIds, defaultQuery, and defaultBody are JSON strings in the deep —
     * they must be unshackled before they can be used by the crew.
     * If parsing fails, the field defaults to an empty hold.
     */
    protected parseEntity(data: any): IKennelConfig {
        // Without an object, no parsing can be done — the void gave us nothing.
        if (!data || typeof data !== 'object') {
            throw new Error('parseEntity: data ist kein Objekt');
        }

        // Unshackle dogIds from its JSON-string prison — it must be an array of hound names.
        let dogIds: string[] = [];
        if (data.dogIds !== null && data.dogIds !== undefined) {
            if (typeof data.dogIds === 'string') {
                if (data.dogIds.trim() !== '') {
                    try {
                        const parsed = JSON.parse(data.dogIds);
                        dogIds = Array.isArray(parsed) ? parsed : [];
                    } catch (e) {
                        dogIds = []; // The JSON was corrupted — sail on with an empty pack.
                    }
                }
            } else if (Array.isArray(data.dogIds)) {
                dogIds = data.dogIds;
            }
        }

        // Unshackle defaultQuery — the query parameters the kennel carries by default.
        let defaultQuery: Record<string, string> | undefined = undefined;
        if (data.defaultQuery) {
            if (typeof data.defaultQuery === 'string') {
                try {
                    defaultQuery = JSON.parse(data.defaultQuery);
                } catch (e) {
                    console.warn('[parseEntity] Fehler beim Parsen von defaultQuery:', e);
                }
            } else if (typeof data.defaultQuery === 'object') {
                defaultQuery = data.defaultQuery;
            }
        }

        // Unshackle defaultBody — the body the kennel carries when no other cargo is given.
        let defaultBody: any = undefined;
        if (data.defaultBody !== null && data.defaultBody !== undefined) {
            if (typeof data.defaultBody === 'string') {
                try {
                    defaultBody = JSON.parse(data.defaultBody);
                } catch (e) {
                    console.warn('[parseEntity] Fehler beim Parsen von defaultBody:', e);
                }
            } else {
                defaultBody = data.defaultBody;
            }
        }

        // Guarantee the pack is always an array — a kennel without dogs is still a kennel.
        if (!Array.isArray(dogIds)) {
            dogIds = [];
        }

        return {
            id: data.id,
            name: data.name,
            description: data.description,
            emoji: typeof data.emoji === 'string' && data.emoji.trim() !== '' ? data.emoji.trim() : undefined,
            dogIds: dogIds,
            defaultQuery,
            defaultBody,
            createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
            updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined
        } as IKennelConfig;
    }
}

