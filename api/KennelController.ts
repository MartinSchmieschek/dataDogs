import { AbstractController, ICreateInput, IUpdateInput, IControllerResponse } from './AbstractController';
import { IStore } from '../store/IStore';
import { IKennelConfig } from 'datadogs';

/**
 * Input für Create-Operation
 */
export interface ICreateKennelInput extends ICreateInput {
    id?: string;
    name?: string;
    description?: string;
    emoji?: string;
    dogIds?: string[];
}

/**
 * Input für Save/Update-Operation
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
 * Controller für Kennel-Configs
 * Verwaltet welche Dogs in einem Kennel sind
 */
export class KennelController extends AbstractController<IKennelConfig> {
    private readonly KENNEL_TYPE = 'KennelConfig';

    constructor(store: IStore) {
        super(store, 'KennelConfig');
    }

    /**
     * Erstellt eine neue Kennel-Config
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
            
            // Verifiziere, dass die Config gespeichert wurde
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
     * Speichert oder aktualisiert eine Kennel-Config
     */
    async save(input: ISaveKennelInput): Promise<IControllerResponse<IKennelConfig>> {
        try {
            if (!input.id) {
                return { ok: false, error: 'id is required' };
            }

            // Lade existierende Config, falls vorhanden
            let existing: IKennelConfig | null = null;
            const existingData = await this.store.load(input.id);
            if (existingData) {
                existing = this.parseEntity(existingData);
            }

            // Merge mit existierender Config oder erstelle neue
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
     * Überschreibt getById um sicherzustellen, dass parseEntity korrekt aufgerufen wird
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
     * Überschreibt list() um direkt r zu verwenden, nicht r.serializedDogConfig
     */
    async list(filter?: Partial<IKennelConfig>): Promise<IControllerResponse<IKennelConfig[]>> {
        try {
            const results = await this.store.findByType(this.entityType);
            let entities = results.map((r: any) => {
                const parsed = this.parseEntity(r); // Direkt r verwenden, nicht r.serializedDogConfig
                // Stelle sicher, dass die ID aus dem Store-Objekt übernommen wird
                if (r.id) {
                    parsed.id = r.id;
                }
                return parsed;
            });
            
            // Optional: Filter anwenden
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
     * Überschreibt parseEntity für Kennel-Configs
     */
    protected parseEntity(data: any): IKennelConfig {
        // dogIds wird als JSON-String gespeichert, muss geparst werden
        if (!data || typeof data !== 'object') {
            throw new Error('parseEntity: data ist kein Objekt');
        }
        
        let dogIds: string[] = [];
        if (data.dogIds !== null && data.dogIds !== undefined) {
            if (typeof data.dogIds === 'string') {
                if (data.dogIds.trim() !== '') {
                    try {
                        const parsed = JSON.parse(data.dogIds);
                        dogIds = Array.isArray(parsed) ? parsed : [];
                    } catch (e) {
                        dogIds = [];
                    }
                }
            } else if (Array.isArray(data.dogIds)) {
                dogIds = data.dogIds;
            }
        }
        
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
        
        // Stelle sicher, dass dogIds IMMER ein Array ist
        if (!Array.isArray(dogIds)) {
            dogIds = [];
        }
        
        return {
            id: data.id,
            name: data.name,
            description: data.description,
            emoji: typeof data.emoji === 'string' && data.emoji.trim() !== '' ? data.emoji.trim() : undefined,
            dogIds: dogIds, // Garantiert ein Array
            defaultQuery,
            defaultBody,
            createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
            updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined
        } as IKennelConfig;
    }
}

