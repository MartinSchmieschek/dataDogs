import { IStore } from '../store/IStore';

/**
 * Basis-Interface für alle Entities, die von Controllern verwaltet werden
 */
export interface IEntity {
    id?: string;  // Optional, da beim Erstellen noch keine ID vorhanden sein muss
    [key: string]: any;
}

/**
 * Input-DTO für Create-Operationen
 */
export interface ICreateInput {
    [key: string]: any;
}

/**
 * Input-DTO für Update/Save-Operationen
 */
export interface IUpdateInput {
    id?: string;
    version?: number;  // Versionsnummer für Versionierung
    [key: string]: any;
}

/**
 * Response-Typ für Controller-Operationen
 */
export interface IControllerResponse<T = any> {
    ok: boolean;
    data?: T;
    error?: string;
    id?: string;
}

/**
 * Abstrakter Controller mit generischem CRUD-Interface
 * Kann für verschiedene Entity-Typen erweitert werden
 */
export abstract class AbstractController<T extends IEntity = IEntity> {
    protected store: IStore;
    protected entityType: string;

    /**
     * @param store - Der Store für Datenbankzugriffe
     * @param entityType - Der Typ der Entity (z.B. SerializedDog.name)
     */
    constructor(store: IStore, entityType: string) {
        this.store = store;
        this.entityType = entityType;
    }

    /**
     * Erstellt eine neue Entity
     * @param input - Die Eingabedaten für die neue Entity
     * @returns Die erstellte Entity mit ID
     */
    abstract create(input: ICreateInput): Promise<IControllerResponse<T>>;

    /**
     * Speichert oder aktualisiert eine Entity
     * @param input - Die Eingabedaten (muss id enthalten für Update)
     * @returns Die gespeicherte Entity
     */
    abstract save(input: IUpdateInput): Promise<IControllerResponse<T>>;

    /**
     * Lädt eine Entity anhand ihrer ID
     * @param id - Die ID der Entity
     * @returns Die Entity oder null
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
     * Listet alle Entities dieses Typs auf
     * @param filter - Optional: Filter-Kriterien
     * @returns Array von Entities
     */
    async list(filter?: Partial<T>): Promise<IControllerResponse<T[]>> {
        try {
            const results = await this.store.findByType(this.entityType);
            let entities = results.map((r: any) => {
                const parsed = this.parseEntity(r.serializedDogConfig || r);
                // Stelle sicher, dass die ID aus dem Store-Objekt übernommen wird (falls nicht bereits in parsed)
                if (r.id) {
                    parsed.id = r.id;
                }
                return parsed;
            });
            
            // Optional: Filter anwenden
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
     * Löscht eine Entity anhand ihrer ID
     * @param id - Die ID der zu löschenden Entity
     * @returns Erfolgsstatus
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
     * Prüft, ob eine Entity existiert
     * @param id - Die ID der Entity
     * @returns true, falls die Entity existiert
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
     * Parst eine Entity aus dem Store-Format
     * Muss von abgeleiteten Klassen überschrieben werden, falls spezielle Parsing-Logik benötigt wird
     */
    protected parseEntity(data: any): T {
        if (typeof data === 'string') {
            return JSON.parse(data) as T;
        }
        return data as T;
    }
}

