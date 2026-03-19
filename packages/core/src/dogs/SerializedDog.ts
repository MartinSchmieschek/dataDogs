import { Dog } from "../core/entities/abstractHuntingDog";
import { DogClass, IHuntingDog } from "../core/entities/IHuntingDog";
import { IHuntingSeason } from "../core/entities/IHuntingSeason";
import * as vm from "vm";

/**
 * Input-DTO für Update/Save-Operationen
 * Wird von SerializedDog verwendet, um die Konfiguration zu definieren
 */
export interface IUpdateInput {
    id?: string;
    version?: number;  // Versionsnummer für Versionierung
    [key: string]: any;
}

/**
 * Konfiguration für SerializedDog
 * Erweitert IUpdateInput für Save/Update-Operationen
 */
export interface ISerializedDogConfig extends IUpdateInput {
    theRun: string;  // Der TypeScript-Code, der ausgeführt wird (required, nicht optional)
    // version ist in IUpdateInput definiert
    /** Optional display glyph (e.g. emoji) for UI */
    icon?: string;
    parentsRequired?: string[];  // Node-IDs der required Eltern
    parentsOptional?: string[];  // Node-IDs der optional Eltern
    // Unterstützt auch tsCode/code als Alternative zu theRun (wird in ConfigRouteHandler gemappt)
    tsCode?: string;  // Alternative zu theRun (wird zu theRun gemappt)
    code?: string;   // Alternative zu theRun (wird zu theRun gemappt)
}

export class SerializedDog<T> extends Dog<T> {

    private _storageId

    public get storageId(): string{
        return this._storageId
    }

    private requiredYieldsContext: Map<string, any> = new Map<string, any>();
    private kennelRef: Array<IHuntingDog<unknown>> | null = null; // Referenz zum Kennel für Parent-Lookup

    public setKennelRef(kennel: Array<IHuntingDog<unknown>>): void {
        this.kennelRef = kennel;
    }

    /**
     * Erstellt das Basis-Context-Objekt mit Standard-Keys (fetch, console)
     * Wird von simpleVmContext verwendet, um synchron mit runExternalCode zu bleiben
     */
    protected buildBaseContext(): Record<string, any> {
        return {
            fetch: fetch,
            console: console,
        };
    }

    /**
     * Merged Parent-Dogs in das Context-Objekt
     * @param contextObj Das Basis-Context-Objekt, in das die Dogs gemerged werden
     * @param parentSource Die Datenquelle für die Parent-Dogs (kennelRef oder season.exhausted)
     * @param useExhausted Wenn true, nutzt season.exhausted (für Laufzeit), wenn false, nutzt kennelRef (für Type-Definitionen)
     */
    private mergeParentDogsIntoContext(
        contextObj: Record<string, any>,
        parentSource: Array<IHuntingDog<unknown>> | null,
        useExhausted: boolean = false
    ): void {
        if (!parentSource) {
            return;
        }

        const parentsRequired = this.config.parentsRequired || [];
        const parentsOptional = this.config.parentsOptional || [];
        const allParentIds = [...parentsRequired, ...parentsOptional];

        allParentIds.forEach((parentId: string) => {
            // Finde Dog anhand ID (storageId für SerializedDogs, name für andere)
            const parentDog = parentSource.find(dog => {
                if (dog instanceof SerializedDog) {
                    return (dog as SerializedDog<unknown>).storageId === parentId;
                }
                return dog.name === parentId;
            });

            if (parentDog) {
                const dogName = parentDog.name;

                if (useExhausted) {
                    // Für Laufzeit: Nur wenn collected !== undefined
                    if (parentDog.collected !== undefined) {
                        contextObj[dogName] = parentDog.collected;
                        this.requiredYieldsContext.set(dogName, parentDog.collected);
                    }
                } else {
                    // Für Type-Definitionen: Verwende collected || {} als Platzhalter
                    contextObj[dogName] = parentDog.collected || {};
                }
            }
        });
    }

    public get simpleVmContext(): Record<string, any> | undefined{
        // Nutze dasselbe Basis-Context-Objekt wie runExternalCode (fetch, console)
        const justContext = this.buildBaseContext();
        
        // Merge requiredYieldsContext (falls bereits vorhanden, z.B. nach vorherigen Runs)
        this.requiredYieldsContext.forEach((value, key) => {
            justContext[key] = value;
        });
        
        // Merge Parent-Dogs aus kennelRef (für Type-Definitionen)
        // Nutzt collected || {} als Platzhalter für Type-Definitionen
        this.mergeParentDogsIntoContext(justContext, this.kennelRef, false);
        
        return justContext;
    }

    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        // Mappe Parent-IDs aus Config zu Dog-Klassen
        if (!this.kennelRef) {
            return [];
        }
        
        const parentsRequired = this.config.parentsRequired || [];
        const requiredClasses: (new (...args: any[]) => IHuntingDog<unknown>)[] = [];
        
        parentsRequired.forEach((parentId: string) => {
            const parentDog = this.kennelRef!.find(dog => {
                if (dog instanceof SerializedDog) {
                    return (dog as SerializedDog<unknown>).storageId === parentId;
                }
                return dog.name === parentId;
            });
            
            if (parentDog) {
                // Hole die Konstruktor-Klasse der Parent-Instanz
                const parentClass = parentDog.constructor as new (...args: any[]) => IHuntingDog<unknown>;
                // Füge nur hinzu, wenn noch nicht vorhanden (vermeide Duplikate)
                if (!requiredClasses.includes(parentClass)) {
                    requiredClasses.push(parentClass);
                }
            }
        });
        
        return requiredClasses;
    }
    
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        // Mappe Parent-IDs aus Config zu Dog-Klassen
        if (!this.kennelRef) {
            return [];
        }
        
        const parentsOptional = this.config.parentsOptional || [];
        const optionalClasses: (new (...args: any[]) => IHuntingDog<unknown>)[] = [];
        
        parentsOptional.forEach((parentId: string) => {
            const parentDog = this.kennelRef!.find(dog => {
                if (dog instanceof SerializedDog) {
                    return (dog as SerializedDog<unknown>).storageId === parentId;
                }
                return dog.name === parentId;
            });
            
            if (parentDog) {
                // Hole die Konstruktor-Klasse der Parent-Instanz
                const parentClass = parentDog.constructor as new (...args: any[]) => IHuntingDog<unknown>;
                // Füge nur hinzu, wenn noch nicht vorhanden (vermeide Duplikate)
                if (!optionalClasses.includes(parentClass)) {
                    optionalClasses.push(parentClass);
                }
            }
        });
        
        return optionalClasses;
    }

    get name(): string {
        // Konvertiere storageId zu CamelCase (z.B. "node-v2" -> "NodeV2")
        const camelCaseId = this.toCamelCase(this.storageId);
        return camelCaseId;
    }

    get icon(): string | undefined {
        const c = this.config as ISerializedDogConfig;
        return typeof c?.icon === 'string' ? c.icon : undefined;
    }
    
    private toCamelCase(id: string): string {
        // Entferne Version-Suffix (z.B. "-v2" -> "")
        const withoutVersion = id.replace(/-v\d+$/, '');
        // Konvertiere zu CamelCase: "node-name" -> "NodeName", "node_name" -> "NodeName"
        return withoutVersion
            .split(/[-_\s]+/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
    }


    public get instanceConfig():any{
        return this.config
    }

    /**
     * Überschreibe matchesParent, um spezifische Instanzen nach storageId/name zu prüfen.
     * Die Basis-isReady Logik verwendet diese Methode für instanz-spezifische Prüfung.
     * 
     * Für SerializedDog: Prüfe, ob die gegebene Instanz eine der spezifischen Parent-Instanzen ist,
     * die in required/optional definiert sind. Die parentClass wird ignoriert, da wir nach
     * spezifischen Instanzen (storageId/name) suchen.
     */
    protected matchesParent(parentClass: (new (...args: any[]) => IHuntingDog<unknown>), instance: IHuntingDog<unknown>): boolean {
        // Zuerst prüfe, ob es eine Instanz der Klasse ist (Standard-Prüfung)
        if (!(instance instanceof parentClass)) {
            return false;
        }
        
        // Für SerializedDog: Prüfe, ob die spezifische Instanz (nach storageId/name) in den Parents ist
        // Hole die spezifischen Parent-IDs aus der Config
        const parentsRequired = this.config.parentsRequired || [];
        const parentsOptional = this.config.parentsOptional || [];
        const allParents = [...parentsRequired, ...parentsOptional];
        
        // Wenn keine spezifischen Parents definiert sind, verwende Standard-Klassen-Prüfung
        if (allParents.length === 0) {
            return true;
        }
        
        // Prüfe, ob diese Instanz eine der spezifischen Parent-Instanzen ist
        // (nach storageId für SerializedDog, sonst nach name)
        return allParents.some((parentId: string) => {
            if (instance instanceof SerializedDog) {
                return (instance as SerializedDog<unknown>).storageId === parentId;
            }
            return instance.name === parentId;
        });
    }

    protected yieldCollectorFactory: (season: IHuntingSeason) => Promise<T> = (season:IHuntingSeason) => {
            return this.runExternalCode(season)
        }

    constructor(private config:ISerializedDogConfig, private storageIdentifier:string) {
        super();
        this._storageId = storageIdentifier
        if (!this.config.theRun){
            this.config.theRun = `throw new Error("Empty yieldCollector!")`
        }
    }

    public async runExternalCode(
    season: IHuntingSeason
  ): Promise<T>  {

        // Benutzer-Code wrappen in async-Funktion
        const wrappedCode = `
            (async () => {
                try {
                    ${this.config.theRun}
                } catch (err) {
                    throw err;
                }
            })()
        `;

        // Erstelle Context mit nur required/optional exhausted dogs als globale Variablen
        const contextObj: any = {
            fetch,
            console,
        };
        
        // this magic binds the exausted dogs yield into a virtual realm so every magic can safly happen. 
        // Füge nur required/optional Parents aus Config zum Context hinzu
        const parentsRequired = this.config.parentsRequired || [];
        const parentsOptional = this.config.parentsOptional || [];
        const allParentIds = [...parentsRequired, ...parentsOptional];
        
        allParentIds.forEach((parentId: string) => {
            // Finde Dog anhand ID (storageId für SerializedDogs, name für andere)
            const parentDog = season.exhausted.find(dog => {
                if (dog instanceof SerializedDog) {
                    return (dog as SerializedDog<unknown>).storageId === parentId;
                }
                return dog.name === parentId;
            });
            
            if (parentDog && parentDog.collected !== undefined) {
                const dogName = parentDog.name;
                // Setze als Property im Context-Objekt (wird automatisch als globale Variable verfügbar)
                contextObj[dogName] = parentDog.collected;
                this.requiredYieldsContext.set(dogName, parentDog.collected);
                // Debug: Log für SerializedDogs
                if (parentDog instanceof SerializedDog) {
                    console.log(`[SerializedDog ${this.storageId}] Füge ${dogName} (storageId: ${(parentDog as SerializedDog<unknown>).storageId}) zum Context hinzu`);
                }
            } else if (parentDog && parentDog.collected === undefined) {
                console.warn(`[SerializedDog ${this.storageId}] Parent ${parentId} gefunden, aber collected ist undefined`);
            } else {
                console.warn(`[SerializedDog ${this.storageId}] Parent ${parentId} nicht in exhausted gefunden`);
            }
        });
        
        // Debug: Log alle exhausted dogs und Context-Keys
        console.log(`[SerializedDog ${this.storageId}] Required/Optional Parent IDs:`, allParentIds);
        console.log(`[SerializedDog ${this.storageId}] Context keys vor createContext:`, Object.keys(contextObj));
        
        // Erstelle VM Context NACH dem Hinzufügen aller Variablen
        // WICHTIG: Alle Variablen müssen VOR createContext gesetzt werden!
        const context = vm.createContext(contextObj);
        
        // Debug: Prüfe ob Variablen nach createContext verfügbar sind
        console.log(`[SerializedDog ${this.storageId}] Context keys nach createContext:`, Object.keys(context));

        // Script
        const script = new vm.Script(wrappedCode);

        try {
            const result = await script.runInContext(context);
            return result as T;
        } catch (err: any) {
            //TODO: Provide proper errors to ui
            console.error("Script Error:", err);
            return ("Error: " + err.message) as T
            //throw err;
        }
    }


}


