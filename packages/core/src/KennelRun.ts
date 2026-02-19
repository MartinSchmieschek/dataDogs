import { IHuntingDog as IDog } from './core/entities/IHuntingDog';
import { SerializedDog } from './dogs/SerializedDog';
import { SeasonRunner } from './harverster';
import { IHuntingSeason } from './core/entities/IHuntingSeason';

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
            
            // BodyRetriever vorübergehend deaktiviert
            if (typeName === 'BodyRetriever') {
                console.log(`[KennelRun.fillKennel] BodyRetriever ist deaktiviert, überspringe`);
                return; // Überspringe diesen Dog
            }
            
            const BaseDogClass = this.baseDogClasses.get(typeName);
            if (BaseDogClass) {
                // Spezielle Behandlung für QueryRetriever - benötigt queryData
                // Für andere Dogs: Erstelle IMMER neue Instanz - verhindert Caching von Ergebnissen
                let baseDog: IDog<unknown>;
                if (typeName === 'QueryRetriever') {
                    // QueryRetriever benötigt queryData - muss vom Hauptprojekt bereitgestellt werden
                    // Wir können hier nicht direkt QueryRetriever importieren, da es im Hauptprojekt ist
                    // Der Aufrufer muss eine spezielle Factory-Funktion bereitstellen oder QueryRetriever selbst erstellen
                    console.warn(`[KennelRun.fillKennel] QueryRetriever benötigt queryData - sollte vom Hauptprojekt erstellt werden`);
                    return; // Überspringe, da wir QueryRetriever nicht direkt erstellen können
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
     * @returns IHuntingSeason mit den Ergebnissen
     */
    public async runSeason(kennel?: Array<IDog<unknown>>): Promise<IHuntingSeason> {
        // Wenn kein Kennel übergeben wurde, lade es
        if (!kennel) {
            kennel = await this.fillKennel();
        }

        const hunt = new SeasonRunner({ kennel });
        const theHunt = await hunt.run();

        console.log(theHunt);

        return theHunt;
    }

    /**
     * Führt einen kompletten Run aus (fillKennel + runSeason)
     * @returns IHuntingSeason mit den Ergebnissen
     */
    public async run(): Promise<IHuntingSeason> {
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


