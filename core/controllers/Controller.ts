import { AbstractController, ICreateInput, IUpdateInput, IControllerResponse } from './AbstractController';
import { IStore } from '../../store/IStore';

/**
 * Generischer Controller als einfache API-Bindung eines Stores
 * Kann für beliebige Config-Typen verwendet werden
 */
export class Controller<T extends { id?: string; [key: string]: any }> extends AbstractController<T> {
    /**
     * @param store - Der Store für Datenbankzugriffe
     * @param entityType - Optional: Der Typ der Entity (wird aus dem Generic abgeleitet, falls nicht angegeben)
     */
    constructor(store: IStore, entityType?: string) {
        // Wenn kein entityType angegeben, verwende einen generischen Namen
        super(store, entityType || 'Config');
    }

    /**
     * Erstellt eine neue Entity
     * Generiert automatisch eine ID, falls nicht vorhanden
     */
    async create(input: ICreateInput): Promise<IControllerResponse<T>> {
        try {
            const id = input.id || `${this.entityType.toLowerCase()}-${Date.now()}`;
            const entity: T = {
                ...input,
                id
            } as T;

            // Speichere im Store
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
     * Speichert oder aktualisiert eine Entity
     */
    async save(input: IUpdateInput): Promise<IControllerResponse<T>> {
        try {
            if (!input.id) {
                return { ok: false, error: 'id is required for save operation' };
            }

            const entity: T = {
                ...input
            } as T;

            // Speichere im Store
            await this.store.save({
                id: input.id,
                type: this.entityType,
                serializedDogConfig: JSON.stringify(entity)
            });

            return {
                ok: true,
                id: input.id,
                data: entity
            };
        } catch (error) {
            return { ok: false, error: String(error) };
        }
    }
}

