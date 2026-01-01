import { IStore } from '../store/IStore';
import { IHuntingDog as IDog } from './enities/IHuntingDog';
import { SerializedDog } from '../dogs/SerializedDog';
import { SeasonRunner } from './harverster';
import { Waves, NodeEntry } from '../ui/results';
import { TypeDefBuilder } from '../ui/TypeDefBuilder';

/**
 * Präfix für Basis-Dog-IDs in dogIds
 */
export const BASE_DOG_PREFIX = 'base:';

/**
 * Kennel-Config Interface
 * Speichert welche Dogs in einem Kennel sind
 * Basis-Dogs werden in dogIds mit Präfix "base:" gespeichert (z.B. "base:RandomRecipesRetriever")
 * SerializedDogs werden normal in dogIds gespeichert (z.B. "my-dog-v1")
 */
export interface IKennelConfig {
    id: string;
    name?: string;
    description?: string;
    dogIds: string[]; // Array von Dog-IDs: SerializedDogs (z.B. "my-dog-v1") oder Basis-Dogs (z.B. "base:RandomRecipesRetriever")
    createdAt?: Date;
    updatedAt?: Date;
}

/**
 * Klasse für die Erstellung und Ausführung von Kennel-Runs
 * Ermöglicht mehrere Instanzen für verschiedene Kennel-Konfigurationen
 */
export class KennelRun {
    private store: IStore;
    private baseDogs: Array<IDog<unknown>>;
    private config?: IKennelConfig;
    private availableBaseDogs: Map<string, IDog<unknown>>;

    /**
     * @param store - Der Store für Datenbankzugriffe
     * @param configOrBaseDogs - Optional: Entweder eine IKennelConfig oder eine Liste von Basis-Dogs
     * @param availableBaseDogs - Optional: Map von BaseDog-Namen zu Instanzen (für die Erstellung aus Config)
     */
    constructor(store: IStore, configOrBaseDogs?: IKennelConfig | Array<IDog<unknown>>, availableBaseDogs?: Map<string, IDog<unknown>>) {
        this.store = store;
        this.availableBaseDogs = availableBaseDogs || new Map();
        
        if (configOrBaseDogs && !Array.isArray(configOrBaseDogs)) {
            // Es ist eine IKennelConfig
            this.config = configOrBaseDogs;
            console.log(`[KennelRun.constructor] Config geladen:`, JSON.stringify(this.config, null, 2));
            this.baseDogs = this.createBaseDogsFromConfig(configOrBaseDogs);
            console.log(`[KennelRun.constructor] Erstellt ${this.baseDogs.length} baseDogs aus Config:`, this.baseDogs.map(d => d.name));
        } else {
            // Es ist ein Array von Dogs oder undefined
            this.baseDogs = (configOrBaseDogs as Array<IDog<unknown>>) || [];
            console.log(`[KennelRun.constructor] Keine Config, verwende ${this.baseDogs.length} baseDogs:`, this.baseDogs.map(d => d.name));
        }
    }

    /**
     * Erstellt Basis-Dogs aus einer Kennel-Config
     * Basis-Dogs werden in dogIds mit Präfix "base:" gespeichert (z.B. "base:RandomRecipesRetriever")
     */
    private createBaseDogsFromConfig(config: IKennelConfig): Array<IDog<unknown>> {
        const dogs: Array<IDog<unknown>> = [];
        
        // Extrahiere Basis-Dogs aus dogIds (IDs die mit "base:" beginnen)
        const baseDogIds = (config.dogIds || []).filter(id => id.startsWith(BASE_DOG_PREFIX));
        
        baseDogIds.forEach(baseDogId => {
            // Entferne Präfix "base:" um den Typ-Namen zu erhalten
            const typeName = baseDogId.substring(BASE_DOG_PREFIX.length);
            const baseDog = this.availableBaseDogs.get(typeName);
            if (baseDog) {
                // Erstelle eine neue Instanz basierend auf der vorhandenen
                // Da wir nur den Namen haben, müssen wir die Instanz aus der Map nehmen
                // Für eine echte Instanz-Erstellung müssten wir die Klasse haben, aber
                // wir können die vorhandene Instanz verwenden oder klonen
                dogs.push(baseDog);
            } else {
                console.warn(`[KennelRun] Unbekannter Basis-Dog-Typ: ${typeName}`);
            }
        });
        
        return dogs;
    }

    /**
     * Setzt die Basis-Dogs für diesen KennelRun
     */
    public setBaseDogs(dogs: Array<IDog<unknown>>): void {
        this.baseDogs = dogs;
    }

    /**
     * Gibt die aktuelle Kennel-Config zurück
     */
    public getConfig(): IKennelConfig | undefined {
        return this.config;
    }

    /**
     * Füllt den Zwinger mit Hunden
     * Lädt SerializedDogs aus der DB und kombiniert sie mit den Basis-Dogs
     * Basis-Dogs werden aus dogIds mit Präfix "base:" erstellt
     * SerializedDogs werden aus dogIds ohne "base:" Präfix geladen
     * - Wenn eine dogId eine Version enthält (z.B. "seed-serialized-1-v2"), wird genau diese Version geladen
     * - Wenn eine dogId keine Version enthält (z.B. "seed-serialized-1"), wird die neueste Version geladen
     */
    public async fillKennel(): Promise<Array<IDog<unknown>>> {
        console.log(`[KennelRun.fillKennel] Start`);
        console.log(`[KennelRun.fillKennel] Config vorhanden:`, this.config ? JSON.stringify(this.config, null, 2) : 'keine');
        
        const kennel: Array<IDog<unknown>> = [];

        // Trenne Basis-Dogs und SerializedDogs aus dogIds
        const dogIds = this.config?.dogIds || [];
        const baseDogIds = dogIds.filter(id => id.startsWith(BASE_DOG_PREFIX));
        const serializedDogIds = dogIds.filter(id => !id.startsWith(BASE_DOG_PREFIX));

        console.log(`[KennelRun.fillKennel] Gefunden: ${baseDogIds.length} Basis-Dogs, ${serializedDogIds.length} SerializedDogs in dogIds`);

        // Erstelle Basis-Dogs aus dogIds
        baseDogIds.forEach(baseDogId => {
            const typeName = baseDogId.substring(BASE_DOG_PREFIX.length);
            const baseDog = this.availableBaseDogs.get(typeName);
            if (baseDog) {
                kennel.push(baseDog);
                console.log(`[KennelRun.fillKennel] Erstellt Basis-Dog: ${typeName}`);
            } else {
                console.warn(`[KennelRun.fillKennel] Unbekannter Basis-Dog-Typ: ${typeName}`);
            }
        });

        // Lade SerializedDogs, wenn welche in dogIds angegeben sind
        if (serializedDogIds.length > 0) {
            // Lade Versionen direkt vom Store
            // - Spezifische Version-IDs werden genau geladen
            // - Basis-IDs ohne Version werden als neueste Version geladen
            const loadedVersions = await this.store.findLatestVersionsByType(SerializedDog.name, serializedDogIds);
            
            const specificVersions = serializedDogIds.filter(id => this.isVersionedId(id)).length;
            const baseIds = serializedDogIds.length - specificVersions;
            console.log(`[KennelRun.fillKennel] Lade ${loadedVersions.length} SerializedDogs (${specificVersions} spezifische Versionen, ${baseIds} Basis-IDs → neueste)`);
            
            // Erstelle SerializedDogs aus den geladenen Versionen
            loadedVersions.forEach((sd: any) => {
                try {
                    const config = typeof sd.serializedDogConfig === 'string' 
                        ? JSON.parse(sd.serializedDogConfig) 
                        : sd.serializedDogConfig;
                    const version = config.version || (sd.id.match(/-v(\d+)$/) ? parseInt(sd.id.match(/-v(\d+)$/)![1], 10) : 'unknown');
                    console.log(`[KennelRun.fillKennel] Lade SerializedDog: ${sd.id}, version: ${version}`);
                    const dog = new SerializedDog(config, sd.id);
                    kennel.push(dog);
                } catch (e) {
                    console.error(`[KennelRun.fillKennel] Fehler beim Laden von SerializedDog ${sd.id}:`, e);
                }
            });
        }
        
        // Setze Kennel-Referenz für alle SerializedDogs (für Parent-Lookup in simpleVmContext)
        kennel.forEach(dog => {
            if (dog instanceof SerializedDog) {
                (dog as SerializedDog<unknown>).setKennelRef(kennel);
            }
        });

        const baseDogsCount = baseDogIds.length;
        const serializedDogsCount = kennel.length - baseDogsCount;
        console.log(`[KennelRun.fillKennel] Kennel gefüllt mit ${kennel.length} Dogs (${baseDogsCount} baseDogs + ${serializedDogsCount} SerializedDogs)`);
        return kennel;
    }

    /**
     * Führt die Jagd/Wellen aus
     * @param kennel - Optional: Wenn nicht angegeben, wird fillKennel() aufgerufen
     */
    public async runSeason(kennel?: Array<IDog<unknown>>): Promise<Waves> {
        // Wenn kein Kennel übergeben wurde, lade es
        if (!kennel) {
            kennel = await this.fillKennel();
        }

        const hunt = new SeasonRunner({ kennel });
        const theHunt = await hunt.run();

        console.log(theHunt);

        // Baue Wellen-Struktur
        const waves: Waves = [];
        theHunt.wave.forEach((wave: any) => {
            // Remap Objects, that is no fun and schould be never done!
            waves.push(wave.map((entry: any) => {
                //create Waves dog entry 
                const nodeEntry = {
                    id: (entry.instance instanceof SerializedDog) 
                        ? (entry.instance as SerializedDog<unknown>).storageId 
                        : entry.instance.name,
                    name: entry.instance.name,
                    result: entry.instance.collected,
                    error: (entry.instance as any).__error || undefined,  // Fehler falls vorhanden
                    parentsOptional: [],
                    parentsRequired: [],
                } as NodeEntry;

                // add additional codeTs if SerializedDog
                if (entry.instance instanceof SerializedDog) {
                    const seDog = entry.instance as SerializedDog<unknown>;
                    nodeEntry.codeTs = seDog.instanceConfig.theRun;
                    const vmCtx = seDog.simpleVmContext || {};
                    nodeEntry.vmContext = vmCtx; // Füge vmContext hinzu
                    nodeEntry.vmContextTypeDef = TypeDefBuilder.buildContextLib(seDog.name, vmCtx);
                    // Übergebe die vollständige Config an die UI (aus DB, nicht aus Runtime)
                    nodeEntry.serializedDogConfig = {
                        theRun: seDog.instanceConfig.theRun,
                        version: seDog.instanceConfig.version,
                        parentsRequired: seDog.instanceConfig.parentsRequired || [],
                        parentsOptional: seDog.instanceConfig.parentsOptional || []
                    };
                    // Nutze die Config-Werte für parentsRequired/Optional (aus DB)
                    nodeEntry.parentsRequired = seDog.instanceConfig.parentsRequired || [];
                    nodeEntry.parentsOptional = seDog.instanceConfig.parentsOptional || [];
                } else {
                    // Für nicht-SerializedDogs: nutze Runtime-Werte
                    nodeEntry.parentsOptional = [...entry.optionalRequiresFrom ? entry.optionalRequiresFrom.map((r: any) => {
                        return (r.instance instanceof SerializedDog) 
                            ? (r.instance as SerializedDog<unknown>).storageId 
                            : r.instance.name;
                    }) : []];
                    nodeEntry.parentsRequired = [...entry.requiresFrom ? entry.requiresFrom.map((r: any) => {
                        return (r.instance instanceof SerializedDog) 
                            ? (r.instance as SerializedDog<unknown>).storageId 
                            : r.instance.name;
                    }) : []];
                }

                return nodeEntry;
            }));
        });

        return waves;
    }

    /**
     * Führt einen kompletten Run aus (fillKennel + runSeason)
     */
    public async run(): Promise<Waves> {
        const kennel = await this.fillKennel();
        return await this.runSeason(kennel);
    }

    /**
     * Extrahiert die Basis-ID aus einer Version-ID
     * z.B. "seed-serialized-1-v2" -> "seed-serialized-1"
     */
    private extractBaseId(id: string): string {
        const match = id.match(/^(.+)-v\d+$/);
        return match ? match[1] : id;
    }

    /**
     * Prüft, ob eine ID eine Versions-ID ist (enthält -v\d+)
     */
    private isVersionedId(id: string): boolean {
        return /-v\d+$/.test(id);
    }
}

