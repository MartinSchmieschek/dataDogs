import { AbstractController, ICreateInput, IUpdateInput, IControllerResponse } from './AbstractController';
import { IStore } from '../store/IStore';
import { IKennelConfig } from '../core/KennelRun';

/**
 * Input für Create-Operation
 */
export interface ICreateKennelInput extends ICreateInput {
    id?: string;
    name?: string;
    description?: string;
    dogIds?: string[];
    baseDogTypes?: string[];
}

/**
 * Input für Save/Update-Operation
 */
export interface ISaveKennelInput extends IUpdateInput {
    id: string;
    name?: string;
    description?: string;
    dogIds?: string[];
    baseDogTypes?: string[];
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
                dogIds: input.dogIds || [],
                baseDogTypes: input.baseDogTypes || [],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            console.log(`[KennelController.create] Erstelle neue Kennel-Config: ${id}`);
            console.log(`[KennelController.create] Config:`, JSON.stringify(config, null, 2));
            
            await this.store.save({ 
                id, 
                type: this.KENNEL_TYPE, 
                serializedDogConfig: JSON.stringify(config)
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
                dogIds: input.dogIds !== undefined ? input.dogIds : (existing?.dogIds || []),
                baseDogTypes: input.baseDogTypes !== undefined ? input.baseDogTypes : (existing?.baseDogTypes || []),
                createdAt: existing?.createdAt || new Date(),
                updatedAt: new Date()
            };

            console.log(`[KennelController.save] Speichere Kennel-Config: ${input.id}`);
            console.log(`[KennelController.save] Config:`, JSON.stringify(config, null, 2));
            
            await this.store.save({ 
                id: input.id, 
                type: this.KENNEL_TYPE, 
                serializedDogConfig: JSON.stringify(config)
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
     * Überschreibt parseEntity für Kennel-Configs
     */
    protected parseEntity(data: any): IKennelConfig {
        const parsed = super.parseEntity(data);
        // Stelle sicher, dass dogIds ein Array ist
        if (parsed && !Array.isArray(parsed.dogIds)) {
            parsed.dogIds = [];
        }
        if (parsed && !Array.isArray(parsed.baseDogTypes)) {
            parsed.baseDogTypes = [];
        }
        return parsed as IKennelConfig;
    }
}

