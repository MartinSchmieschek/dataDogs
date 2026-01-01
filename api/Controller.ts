import { AbstractController, ICreateInput, IUpdateInput, IControllerResponse } from './AbstractController';
import { IStore } from '../store/IStore';
import { extractBaseId, getNextVersionId, isVersionedId } from './utils/versioning';

/**
 * Generischer Controller als einfache API-Bindung eines Stores
 * Kann für beliebige Config-Typen verwendet werden
 * Unterstützt automatische Versionsverwaltung
 */
export class Controller<T extends { id?: string; version?: number; [key: string]: any }> extends AbstractController<T> {
    private enableVersioning: boolean;

    /**
     * @param store - Der Store für Datenbankzugriffe
     * @param entityType - Optional: Der Typ der Entity (wird aus dem Generic abgeleitet, falls nicht angegeben)
     * @param enableVersioning - Optional: Aktiviert Versionsverwaltung (Standard: true)
     */
    constructor(store: IStore, entityType?: string, enableVersioning: boolean = true) {
        // Wenn kein entityType angegeben, verwende einen generischen Namen
        super(store, entityType || 'Config');
        this.enableVersioning = enableVersioning;
    }

    /**
     * Erstellt eine neue Entity
     * Generiert automatisch eine ID, falls nicht vorhanden
     * Wenn Versionsverwaltung aktiviert ist, wird die erste Version (v1) erstellt
     */
    async create(input: ICreateInput): Promise<IControllerResponse<T>> {
        try {
            let id = input.id || `${this.entityType.toLowerCase()}-${Date.now()}`;
            
            // Wenn Versionsverwaltung aktiviert ist und ID noch keine Version hat, füge v1 hinzu
            if (this.enableVersioning && !isVersionedId(id)) {
                id = `${id}-v1`;
            }
            
            const entity: T = {
                ...input,
                id,
                version: this.enableVersioning ? 1 : undefined
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
     * Wenn Versionsverwaltung aktiviert ist, wird automatisch eine neue Version erstellt
     */
    async save(input: IUpdateInput): Promise<IControllerResponse<T>> {
        try {
            if (!input.id) {
                return { ok: false, error: 'id is required for save operation' };
            }

            let saveId = input.id;
            let version = input.version;

            // Versionsverwaltung
            if (this.enableVersioning) {
                const baseId = extractBaseId(input.id);
                const nextVersionId = await getNextVersionId(baseId, this.store, this.entityType);
                saveId = nextVersionId;
                
                // Extrahiere Versionsnummer aus der neuen ID
                const versionMatch = nextVersionId.match(/-v(\d+)$/);
                version = versionMatch ? parseInt(versionMatch[1], 10) : 1;
            }

            // Lade existierende Entity, falls vorhanden (für Merge)
            let existing: T | null = null;
            if (this.enableVersioning) {
                const existingData = await this.store.load(input.id);
                if (existingData) {
                    existing = this.parseEntity(existingData);
                } else {
                    // Suche nach neuester Version
                    const baseId = extractBaseId(input.id);
                    const allVersions = await this.store.findByType(this.entityType);
                    const matchingVersions = allVersions.filter((v: any) => {
                        const vBaseId = extractBaseId(v.id);
                        return vBaseId === baseId;
                    });
                    
                    if (matchingVersions.length > 0) {
                        // Sortiere nach version aus Config
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
                // Ohne Versionsverwaltung: Lade direkt
                const existingData = await this.store.load(input.id);
                if (existingData) {
                    existing = this.parseEntity(existingData);
                }
            }

            // Merge mit existierender Entity oder erstelle neue
            const entity: T = {
                ...(existing || {}),
                ...input,
                id: saveId,
                version: version !== undefined ? version : (existing as any)?.version
            } as T;

            // Speichere im Store
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

