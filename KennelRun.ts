import { IHuntingDog as IDog } from './core/enities/IHuntingDog';
import { SerializedDog } from './dogs/SerializedDog';
import { SeasonRunner } from './harverster';
import { Waves, NodeEntry } from './ui/results';
import { TypeDefBuilder } from './ui/TypeDefBuilder';
import { QueryRetriever } from './dogs/QueryRetriever';
import { BodyRetriever } from './dogs/BodyRetriever';

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
    defaultQuery?: Record<string, string>; // Default Query-Parameter für den Editor
    defaultBody?: any; // Default Body-Daten für den Editor
    createdAt?: Date;
    updatedAt?: Date;
}

/**
 * Klasse für die Erstellung und Ausführung von Kennel-Runs
 * Ermöglicht mehrere Instanzen für verschiedene Kennel-Konfigurationen
 */
export class KennelRun {
    private config?: IKennelConfig;
    private baseDogClasses: Map<string, new () => IDog<unknown>>;
    private serializedDogFactory: (ids: string[]) => Promise<Array<SerializedDog<unknown>>>;
    private queryData?: Record<string, string>;
    private bodyData?: any;

    /**
     * @param configOrBaseDogs - Optional: Entweder eine IKennelConfig oder eine Liste von Basis-Dogs (wird aktuell nicht verwendet)
     * @param baseDogClasses - Map von BaseDog-Namen zu Klassen. Wird benötigt, um aus Config-Strings (z.B. "base:RandomRecipesRetriever") neue Instanzen zu erstellen.
     *                        Bei jedem fillKennel() werden neue Instanzen erstellt, damit keine Ergebnisse gecacht werden.
     * @param serializedDogFactory - Factory-Funktion, die SerializedDogs aus IDs erstellt. Bekommt ein Array von IDs und gibt ein Array von SerializedDogs zurück.
     * @param queryData - Optional: Query-Parameter für QueryRetriever
     * @param bodyData - Optional: Body-Daten für BodyRetriever
     */
    constructor(
        configOrBaseDogs?: IKennelConfig | Array<IDog<unknown>>, 
        baseDogClasses: Map<string, new () => IDog<unknown>> = new Map(),
        serializedDogFactory: (ids: string[]) => Promise<Array<SerializedDog<unknown>>> = async () => [],
        queryData?: Record<string, string>,
        bodyData?: any
    ) {
        this.baseDogClasses = baseDogClasses;
        this.serializedDogFactory = serializedDogFactory;
        this.queryData = queryData;
        this.bodyData = bodyData;
        
        if (configOrBaseDogs && !Array.isArray(configOrBaseDogs)) {
            // Es ist eine IKennelConfig
            this.config = configOrBaseDogs;
            console.log(`[KennelRun.constructor] Config geladen:`, JSON.stringify(this.config, null, 2));
        }
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

        // Erstelle Basis-Dogs aus dogIds - IMMER neue Instanzen bei jedem fillKennel() (verhindert Caching)
        baseDogIds.forEach(baseDogId => {
            const typeName = baseDogId.substring(BASE_DOG_PREFIX.length);
            const BaseDogClass = this.baseDogClasses.get(typeName);
            if (BaseDogClass) {
                // Spezielle Behandlung für QueryRetriever und BodyRetriever
                let baseDog: IDog<unknown>;
                if (typeName === 'QueryRetriever') {
                    baseDog = new QueryRetriever(this.queryData);
                } else if (typeName === 'BodyRetriever') {
                    baseDog = new BodyRetriever(this.bodyData);
                } else {
                    // Erstelle IMMER neue Instanz - verhindert Caching von Ergebnissen
                    baseDog = new BaseDogClass();
                }
                kennel.push(baseDog);
                console.log(`[KennelRun.fillKennel] Erstellt neue Basis-Dog-Instanz: ${typeName}`);
            } else {
                console.warn(`[KennelRun.fillKennel] Unbekannter Basis-Dog-Typ: ${typeName}`);
            }
        });

        // Lade SerializedDogs, wenn welche in dogIds angegeben sind
        if (serializedDogIds.length > 0) {
            const specificVersions = serializedDogIds.filter(id => this.isVersionedId(id)).length;
            const baseIds = serializedDogIds.length - specificVersions;
            console.log(`[KennelRun.fillKennel] Lade SerializedDogs (${specificVersions} spezifische Versionen, ${baseIds} Basis-IDs → neueste)`);
            
            // Verwende Factory-Funktion, um SerializedDogs zu erstellen
            const serializedDogs = await this.serializedDogFactory(serializedDogIds);
            console.log(`[KennelRun.fillKennel] Factory erstellt ${serializedDogs.length} SerializedDogs`);
            
            serializedDogs.forEach(dog => {
                kennel.push(dog);
                console.log(`[KennelRun.fillKennel] SerializedDog hinzugefügt: ${dog.storageId}`);
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
        theHunt.wave.forEach((wave: any, waveIndex: number) => {
            // Remap Objects, that is no fun and schould be never done!
            waves.push(wave.map((entry: any) => {
                const instance = entry.instance;
                const instanceId = (instance instanceof SerializedDog) 
                    ? (instance as SerializedDog<unknown>).storageId 
                    : instance.name;
                const instanceName = instance.name;
                
                // Sammle readTracking-Daten für diese Instance
                const readFrom: any[] = []; // Properties, die diese Instance von anderen liest
                const readBy: any[] = [];   // Properties dieser Instance, die von anderen gelesen werden
                
                theHunt.readTracking.forEach((trackingEntry: any) => {
                    const readerName = trackingEntry.readerInstance.name;
                    const sourceName = trackingEntry.sourceInstance.name;
                    const readerId = (trackingEntry.readerInstance instanceof SerializedDog)
                        ? (trackingEntry.readerInstance as SerializedDog<unknown>).storageId
                        : trackingEntry.readerInstance.name;
                    const sourceId = (trackingEntry.sourceInstance instanceof SerializedDog)
                        ? (trackingEntry.sourceInstance as SerializedDog<unknown>).storageId
                        : trackingEntry.sourceInstance.name;
                    
                    // readFrom: Diese Instance liest von anderen
                    if (readerId === instanceId || readerName === instanceName) {
                        readFrom.push({
                            waveIndex: trackingEntry.waveIndex,
                            readerInstanceName: readerName,
                            sourceInstanceName: sourceName,
                            propertyPath: trackingEntry.propertyPath
                        });
                    }
                    
                    // readBy: Andere lesen von dieser Instance
                    if (sourceId === instanceId || sourceName === instanceName) {
                        readBy.push({
                            waveIndex: trackingEntry.waveIndex,
                            readerInstanceName: readerName,
                            sourceInstanceName: sourceName,
                            propertyPath: trackingEntry.propertyPath
                        });
                    }
                });
                
                //create Waves dog entry 
                const nodeEntry = {
                    id: instanceId,
                    name: instanceName,
                    result: instance.collected,
                    error: (instance as any).__error || undefined,  // Fehler falls vorhanden
                    parentsOptional: [],
                    parentsRequired: [],
                    readFrom: readFrom.length > 0 ? readFrom : undefined,
                    readBy: readBy.length > 0 ? readBy : undefined,
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
     * Prüft, ob eine ID eine Versions-ID ist (enthält -v\d+)
     */
    private isVersionedId(id: string): boolean {
        return /-v\d+$/.test(id);
    }
}

