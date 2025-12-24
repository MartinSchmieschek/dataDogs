import { Dog } from "../core/enities/abstractHuntingDog";
import { DogClass, IHuntingDog } from "../core/enities/IHuntingDog";
import { IHuntingSeason } from "../core/enities/IHuntingSeason";
import * as vm from "vm";
import { IUpdateInput } from "../api/AbstractController";

/**
 * Konfiguration für SerializedDog
 * Erweitert IUpdateInput für Save/Update-Operationen
 */
export interface ISerializedDogConfig extends IUpdateInput {
    theRun: string;  // Der TypeScript-Code, der ausgeführt wird (required, nicht optional)
    // version ist in IUpdateInput definiert
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

    public get simpleVmContext(): Record<string, any> | undefined{
        let justContext:any = {
            fetch:fetch,
            console,
            }
        this.requiredYieldsContext.forEach((value, key) => {
            justContext[key] = value
        })
        
        // Füge required/optional Parents aus Config hinzu (für Monaco Editor)
        // Diese werden zur Laufzeit aus season.exhausted gefüllt, aber für Type Definitions
        // brauchen wir die Info aus dem Kennel
        if (this.kennelRef) {
            const parentsRequired = this.config.parentsRequired || [];
            parentsRequired.forEach((parentId: string) => {
                const parentDog = this.kennelRef!.find(dog => {
                    if (dog instanceof SerializedDog) {
                        return (dog as SerializedDog<unknown>).storageId === parentId;
                    }
                    return dog.name === parentId;
                });
                if (parentDog) {
                    // Nutze Parent-Name (CamelCase) als Variablennamen
                    const safeName = parentDog.name;
                    // Für Type Definitions: verwende einen Platzhalter-Typ
                    justContext[safeName] = parentDog.collected || {};
                }
            });
            
            const parentsOptional = this.config.parentsOptional || [];
            parentsOptional.forEach((parentId: string) => {
                const parentDog = this.kennelRef!.find(dog => {
                    if (dog instanceof SerializedDog) {
                        return (dog as SerializedDog<unknown>).storageId === parentId;
                    }
                    return dog.name === parentId;
                });
                if (parentDog) {
                    // Nutze Parent-Name (CamelCase) als Variablennamen
                    const safeName = parentDog.name;
                    // Für Type Definitions: verwende einen Platzhalter-Typ
                    justContext[safeName] = parentDog.collected || {};
                }
            });
        }
        
        return justContext
        
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