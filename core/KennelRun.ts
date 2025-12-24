import { IStore } from '../store/IStore';
import { IHuntingDog as IDog } from './enities/IHuntingDog';
import { SerializedDog } from '../dogs/SerializedDog';
import { SeasonRunner } from './harverster';
import { Waves, NodeEntry } from '../ui/results';
import { TypeDefBuilder } from '../ui/TypeDefBuilder';
import { RandomRecipesRetriever } from '../dogs/RandomRecipesRetriever';
import { CountryFlagBlackLab } from '../dogs/CountryFlagBlackLab';
import { DishFlagBlackLab } from '../dogs/DishFlagBlackLab';
import { RandomEveryThingRetriever } from '../dogs/RandomEverthingRetriever';
import { TalkingDog } from '../dogs/TalkingDogs/TalkingDog';

/**
 * Kennel-Config Interface
 * Speichert welche Dogs in einem Kennel sind
 * Diese Config kann optional im KennelRun Constructor verwendet werden
 */
export interface IKennelConfig {
    id: string;
    name?: string;
    description?: string;
    dogIds: string[]; // Array von Dog-IDs, die im Kennel sind
    baseDogTypes?: string[]; // Optionale Liste von Basis-Dog-Typen (z.B. ['RandomRecipesRetriever'])
    createdAt?: Date;
    updatedAt?: Date;
}

/**
 * Mapping von Dog-Typ-Namen zu ihren Klassen
 */
const DOG_TYPE_MAP: Record<string, new () => IDog<unknown>> = {
    'RandomRecipesRetriever': RandomRecipesRetriever,
    'CountryFlagBlackLab': CountryFlagBlackLab,
    'DishFlagBlackLab': DishFlagBlackLab,
    'RandomEveryThingRetriever': RandomEveryThingRetriever,
    'TalkingDog': TalkingDog,
};

/**
 * Klasse für die Erstellung und Ausführung von Kennel-Runs
 * Ermöglicht mehrere Instanzen für verschiedene Kennel-Konfigurationen
 */
export class KennelRun {
    private store: IStore;
    private baseDogs: Array<IDog<unknown>>;
    private config?: IKennelConfig;

    /**
     * @param store - Der Store für Datenbankzugriffe
     * @param configOrBaseDogs - Optional: Entweder eine IKennelConfig oder eine Liste von Basis-Dogs
     */
    constructor(store: IStore, configOrBaseDogs?: IKennelConfig | Array<IDog<unknown>>) {
        this.store = store;
        
        if (configOrBaseDogs && !Array.isArray(configOrBaseDogs)) {
            // Es ist eine IKennelConfig
            this.config = configOrBaseDogs;
            console.log(`[KennelRun.constructor] Config geladen:`, JSON.stringify(this.config, null, 2));
            this.baseDogs = this.createBaseDogsFromConfig(configOrBaseDogs);
            console.log(`[KennelRun.constructor] Erstellt ${this.baseDogs.length} baseDogs aus Config:`, this.baseDogs.map(d => d.name));
        } else {
            // Es ist ein Array von Dogs oder undefined
            this.baseDogs = (configOrBaseDogs as Array<IDog<unknown>>) || this.getDefaultBaseDogs();
            console.log(`[KennelRun.constructor] Keine Config, verwende ${this.baseDogs.length} Standard-baseDogs:`, this.baseDogs.map(d => d.name));
        }
    }

    /**
     * Gibt die Standard-Basis-Dogs zurück
     */
    private getDefaultBaseDogs(): Array<IDog<unknown>> {
        return [
            new RandomRecipesRetriever(),
            new CountryFlagBlackLab(),
            new DishFlagBlackLab(),
            new RandomEveryThingRetriever(),
            //new FoodPornRetriever(), // deactivated to much requests for this api key
            new TalkingDog(),
        ];
    }

    /**
     * Erstellt Basis-Dogs aus einer Kennel-Config
     */
    private createBaseDogsFromConfig(config: IKennelConfig): Array<IDog<unknown>> {
        const dogs: Array<IDog<unknown>> = [];
        
        if (config.baseDogTypes && config.baseDogTypes.length > 0) {
            config.baseDogTypes.forEach(typeName => {
                const DogClass = DOG_TYPE_MAP[typeName];
                if (DogClass) {
                    dogs.push(new DogClass());
                } else {
                    console.warn(`[KennelRun] Unbekannter Dog-Typ: ${typeName}`);
                }
            });
        } else {
            // Wenn keine baseDogTypes angegeben, verwende Standard
            return this.getDefaultBaseDogs();
        }
        
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
     * Wenn eine Config vorhanden ist und dogIds angegeben sind, werden nur diese Dogs geladen
     * - Wenn eine dogId eine Version enthält (z.B. "seed-serialized-1-v2"), wird genau diese Version geladen
     * - Wenn eine dogId keine Version enthält (z.B. "seed-serialized-1"), wird die neueste Version geladen
     * Wenn keine dogIds angegeben sind, werden nur die baseDogs geladen (keine SerializedDogs)
     */
    public async fillKennel(): Promise<Array<IDog<unknown>>> {
        console.log(`[KennelRun.fillKennel] Start mit ${this.baseDogs.length} baseDogs:`, this.baseDogs.map(d => d.name));
        console.log(`[KennelRun.fillKennel] Config vorhanden:`, this.config ? JSON.stringify(this.config, null, 2) : 'keine');
        
        const kennel: Array<IDog<unknown>> = [...this.baseDogs];

        // Bestimme welche SerializedDogs geladen werden sollen
        // Nur wenn dogIds in der Config angegeben sind, werden SerializedDogs geladen
        // dogIds können Basis-IDs (z.B. "seed-serialized-1") oder spezifische Version-IDs (z.B. "seed-serialized-1-v2") sein
        const idsToLoad = this.config?.dogIds && this.config.dogIds.length > 0
            ? this.config.dogIds
            : undefined;

        // Lade nur SerializedDogs, wenn dogIds angegeben sind
        if (idsToLoad) {
            // Lade Versionen direkt vom Store
            // - Spezifische Version-IDs werden genau geladen
            // - Basis-IDs ohne Version werden als neueste Version geladen
            const loadedVersions = await this.store.findLatestVersionsByType(SerializedDog.name, idsToLoad);
            
            const specificVersions = idsToLoad.filter(id => this.isVersionedId(id)).length;
            const baseIds = idsToLoad.length - specificVersions;
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
        } else {
            console.log(`[KennelRun.fillKennel] Keine dogIds in Config, lade nur baseDogs (keine SerializedDogs)`);
        }
        
        // Setze Kennel-Referenz für alle SerializedDogs (für Parent-Lookup in simpleVmContext)
        kennel.forEach(dog => {
            if (dog instanceof SerializedDog) {
                (dog as SerializedDog<unknown>).setKennelRef(kennel);
            }
        });

        const serializedDogsCount = kennel.length - this.baseDogs.length;
        console.log(`[KennelRun.fillKennel] Kennel gefüllt mit ${kennel.length} Dogs (${this.baseDogs.length} baseDogs + ${serializedDogsCount} SerializedDogs)`);
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

