/**
 * ~~~ A SPIRIT TRAPPED IN CODE, RUNNING IN A VM SANDBOX ~~~
 *
 * Arr, the SerializedDog be a hound whose very soul is serialized --
 * stored as code in the deep, summoned at runtime into a sandboxed
 * VM realm where it executes its dark purpose. Its parents are bound
 * by ID, its context conjured from the exhausted crew's plunder.
 *
 * Corporeal laws are unwritten, as suns and love retreat.
 * This spirit knows not the world outside its sandbox --
 * only the void-context we grant it, and the code that drives it.
 */

import { Dog } from "../core/entities/abstractHuntingDog";
import { DogClass, IHuntingDog } from "../core/entities/IHuntingDog";
import { IHuntingSeason } from "../core/entities/IHuntingSeason";
import * as vm from "vm";

/**
 * Input DTO fer update/save operations -- the scroll upon which a spirit's new config is writ.
 */
export interface IUpdateInput {
    /** The spirit's unique identifier in this incarnation — a GUID forged in the void */
    id?: string;
    /** The spirit's lineage mark — a GUID that binds all incarnations across branches */
    dogId?: string;
    /** The ancestor from which this incarnation was born — null fer the firstborn */
    parentId?: string | null;
    /** The spirit's true name — changeable without shattering the eldritch pacts of kennel and UI */
    displayName?: string;
    /** @deprecated Version number — a relic of the old linear rite, kept only fer the transition */
    version?: number;
    /** Additional eldritch properties, uncharted and unknowable, carried through the abyss */
    [key: string]: any;
}

/**
 * Configuration fer a SerializedDog -- the eldritch blueprint of a spirit vessel.
 * Extends IUpdateInput fer save/update rites.
 */
export interface ISerializedDogConfig extends IUpdateInput {
    /** The incantation to be executed -- the dark code that gives this spirit its purpose in the void */
    theRun: string;
    /** Optional display sigil (e.g. emoji) fer the UI -- a glyph against the dark */
    icon?: string;
    /** Node IDs of required parent hounds -- sworn oaths that must be fulfilled before this spirit may rise */
    parentsRequired?: string[];
    /** Node IDs of optional parent hounds -- whispers from the deep, heeded only if they be aboard */
    parentsOptional?: string[];
    /** Alternative incantation source (TypeScript) -- mapped to theRun by the carrion hordes of ConfigRouteHandler */
    tsCode?: string;
    /** Alternative incantation source (raw code) -- another path to the same eldritch purpose */
    code?: string;
}

/** A supplier that injects app-specific globals into the VM realm -- the void provides what the core cannot */
export type SerializedDogVmGlobalsSupplier = (
    ctx: Record<string, any>,
    dog: SerializedDog<unknown>,
    /** The kennel (simpleVmContext) or season.exhausted (runExternalCode) -- source hounds fer context */
    sourceDogs: IHuntingDog<unknown>[] | null
) => void;

/**
 * Arr, the SerializedDog -- a spirit trapped in code, summoned from the deep into a sandboxed
 * VM realm where it executes its dark purpose. Its parents are bound by ID, its context
 * conjured from the exhausted crew's plunder. From brooding gulfs are we beheld,
 * by that which bears no name -- yet this spirit runs its incantation regardless.
 * @template T The type of eldritch yield this spirit produces from its sandboxed void
 */
export class SerializedDog<T> extends Dog<T> {

    private _storageId

    /** The spirit's storage identity -- its name in the deep where it sleeps between hunts */
    public get storageId(): string{
        return this._storageId
    }

    /**
     * VM globals suppliers -- set per kennel run by the captain. No global app-enums in the core,
     * fer the core knows only the void, not the world above.
     */
    private vmGlobalsSuppliers: SerializedDogVmGlobalsSupplier[] = [];

    /**
     * Bind additional global incantations to the VM context -- injected by the app/KennelRun.
     */
    public setVmGlobalsSuppliers(suppliers: readonly SerializedDogVmGlobalsSupplier[]): void {
        this.vmGlobalsSuppliers = suppliers.length ? [...suppliers] : [];
    }

    /** Apply all VM globals suppliers to the context -- let each supplier inscribe its runes */
    private applyVmGlobalsSuppliers(
        ctx: Record<string, any>,
        sourceDogs: IHuntingDog<unknown>[] | null
    ): void {
        for (const supplier of this.vmGlobalsSuppliers) {
            supplier(ctx, this as SerializedDog<unknown>, sourceDogs);
        }
    }

    // Cached yields from required parents -- plunder already claimed, stored fer quick access
    private requiredYieldsContext: Map<string, any> = new Map<string, any>();
    // Reference to the kennel -- so this spirit may find its kin in the crew
    private kennelRef: Array<IHuntingDog<unknown>> | null = null;

    /** Bind this spirit to its kennel -- grant it sight of the other hounds aboard */
    public setKennelRef(kennel: Array<IHuntingDog<unknown>>): void {
        this.kennelRef = kennel;
    }

    /**
     * Build the base context object with standard keys (fetch, console).
     * These be the minimal tools every spirit needs to navigate the void.
     */
    protected buildBaseContext(): Record<string, any> {
        return {
            fetch: fetch,
            console: console,
        };
    }

    /**
     * Find a hound in a crew by its parentId reference — matches by storageId, dogId, or name.
     * The void cares not which mark ye bear, so long as it be the right one.
     */
    private findParentDog(parentId: string, source: Array<IHuntingDog<unknown>>): IHuntingDog<unknown> | undefined {
        return source.find(dog => {
            if (dog instanceof SerializedDog) {
                const sDog = dog as SerializedDog<unknown>;
                return sDog.storageId === parentId || sDog.dogId === parentId;
            }
            return dog.name === parentId;
        });
    }

    /**
     * Merge parent dogs into the context -- bind their plunder (or placeholders) as global variables.
     * @param contextObj The base context object to inscribe upon
     * @param parentSource The source of parent hounds (kennelRef or season.exhausted)
     * @param useExhausted If true, uses season.exhausted (runtime); if false, uses kennelRef (type definitions)
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
            const parentDog = this.findParentDog(parentId, parentSource);

            if (parentDog) {
                const dogName = parentDog.name;

                if (useExhausted) {
                    // Runtime: only bind if the hound has actually returned with plunder
                    if (parentDog.collected !== undefined) {
                        contextObj[dogName] = parentDog.collected;
                        this.requiredYieldsContext.set(dogName, parentDog.collected);
                    }
                } else {
                    // Type definitions: use collected or empty placeholder -- the shape matters, not the substance
                    contextObj[dogName] = parentDog.collected || {};
                }
            }
        });
    }

    /**
     * The simple VM context -- a snapshot of what this spirit can see from within its sandbox.
     * Merges base context, cached parent yields, and kennel-ref parents.
     * The void provides only what is needed, nothing more.
     */
    public get simpleVmContext(): Record<string, any> | undefined{
        // Start with the base tools -- fetch and console, the spirit's lifeline
        const justContext = this.buildBaseContext();

        // Merge previously cached parent yields (from prior runs, if any)
        this.requiredYieldsContext.forEach((value, key) => {
            justContext[key] = value;
        });

        // Merge parent dogs from the kennel -- placeholders fer type definitions
        this.mergeParentDogsIntoContext(justContext, this.kennelRef, false);

        this.applyVmGlobalsSuppliers(justContext, this.kennelRef);

        return justContext;
    }

    /** Required parent classes -- resolved from config IDs against the kennel crew */
    get required(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        if (!this.kennelRef) {
            return [];
        }

        const parentsRequired = this.config.parentsRequired || [];
        const requiredClasses: (new (...args: any[]) => IHuntingDog<unknown>)[] = [];

        parentsRequired.forEach((parentId: string) => {
            const parentDog = this.findParentDog(parentId, this.kennelRef!);

            if (parentDog) {
                // Extract the constructor -- the dark blueprint of the parent hound
                const parentClass = parentDog.constructor as new (...args: any[]) => IHuntingDog<unknown>;
                // Avoid duplicates -- one entry per class in the manifest
                if (!requiredClasses.includes(parentClass)) {
                    requiredClasses.push(parentClass);
                }
            }
        });

        return requiredClasses;
    }

    /** Optional parent classes -- hounds we listen fer but do not demand */
    get optional(): (new (...args: any[]) => IHuntingDog<unknown>)[] {
        if (!this.kennelRef) {
            return [];
        }

        const parentsOptional = this.config.parentsOptional || [];
        const optionalClasses: (new (...args: any[]) => IHuntingDog<unknown>)[] = [];

        parentsOptional.forEach((parentId: string) => {
            const parentDog = this.findParentDog(parentId, this.kennelRef!);

            if (parentDog) {
                // Extract the constructor from the optional parent
                const parentClass = parentDog.constructor as new (...args: any[]) => IHuntingDog<unknown>;
                // No duplicates allowed aboard
                if (!optionalClasses.includes(parentClass)) {
                    optionalClasses.push(parentClass);
                }
            }
        });

        return optionalClasses;
    }

    /** The spirit's true name — drawn from displayName if inscribed, else transmuted from storageId */
    get name(): string {
        const cfg = this.config as ISerializedDogConfig;
        if (cfg.displayName) {
            return this.toCamelCase(cfg.displayName);
        }
        return this.toCamelCase(this.storageId);
    }

    /** The spirit's lineage mark — the dogId that binds all its incarnations across branches */
    get dogId(): string | undefined {
        return (this.config as ISerializedDogConfig).dogId;
    }

    /** The spirit's sigil -- an icon from its config, if one was inscribed */
    get icon(): string | undefined {
        const c = this.config as ISerializedDogConfig;
        return typeof c?.icon === 'string' ? c.icon : undefined;
    }

    /** Transmute a name into CamelCase — the spirit's identity in the VM realm must be a valid identifier */
    private toCamelCase(input: string): string {
        // Transmute to CamelCase: "node-name" -> "NodeName", "node_name" -> "NodeName", "My Dog" -> "MyDog"
        return input
            .split(/[-_\s]+/)
            .filter(word => word.length > 0)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
    }


    /** The raw config of this spirit -- its full blueprint, laid bare */
    public get instanceConfig():any{
        return this.config
    }

    /**
     * Override matchesParent fer instance-specific matching by storageId/name.
     * The base isReady logic calls this method -- and fer SerializedDog,
     * we match by specific instance identity, not just class lineage.
     * The parentClass is checked first, then we verify the instance
     * is one of our declared parents. Arr, specificity matters in the deep.
     */
    protected matchesParent(parentClass: (new (...args: any[]) => IHuntingDog<unknown>), instance: IHuntingDog<unknown>): boolean {
        // First, the standard class check -- is it of the right lineage?
        if (!(instance instanceof parentClass)) {
            return false;
        }

        // Fer SerializedDog: verify the specific instance by storageId/name
        const parentsRequired = this.config.parentsRequired || [];
        const parentsOptional = this.config.parentsOptional || [];
        const allParents = [...parentsRequired, ...parentsOptional];

        // If no specific parents declared, the class check alone suffices
        if (allParents.length === 0) {
            return true;
        }

        // Check if this instance be one of our specifically declared parents — by storageId, dogId, or name
        return allParents.some((parentId: string) => {
            if (instance instanceof SerializedDog) {
                const sDog = instance as SerializedDog<unknown>;
                return sDog.storageId === parentId || sDog.dogId === parentId;
            }
            return instance.name === parentId;
        });
    }

    /** The yield collector -- delegates to runExternalCode, where the spirit's incantation is executed */
    protected yieldCollectorFactory: (season: IHuntingSeason) => Promise<T> = (season:IHuntingSeason) => {
            return this.runExternalCode(season)
        }

    /**
     * Summon the spirit into existence -- bind its config and storage identity.
     * If theRun be empty, the spirit throws an error upon execution -- a hollow vessel with no purpose.
     */
    constructor(private config:ISerializedDogConfig, private storageIdentifier:string) {
        super();
        this._storageId = storageIdentifier
        if (!this.config.theRun){
            this.config.theRun = `throw new Error("Empty yieldCollector!")`
        }
    }

    /**
     * Execute the spirit's code in a sandboxed VM realm.
     * Arr, this be the dark heart of the SerializedDog -- where user-written incantations
     * run in an isolated context, with only their declared parents' plunder as globals.
     * The code be wrapped in an async function and executed via vm.runInContext.
     * From brooding gulfs are we beheld, by that which bears no name.
     */
    public async runExternalCode(
    season: IHuntingSeason
  ): Promise<T>  {

        // Wrap the user's incantation in an async function -- the ritual demands it
        const wrappedCode = `
            (async () => {
                try {
                    ${this.config.theRun}
                } catch (err) {
                    throw err;
                }
            })()
        `;

        // Build the context -- only declared parents' yields become global variables
        const contextObj: any = {
            fetch,
            console,
        };

        // This dark magic binds exhausted hounds' yields into the VM realm -- safely contained in the void
        const parentsRequired = this.config.parentsRequired || [];
        const parentsOptional = this.config.parentsOptional || [];
        const allParentIds = [...parentsRequired, ...parentsOptional];

        allParentIds.forEach((parentId: string) => {
            // Find the parent hound by ID in the exhausted crew — matches by storageId, dogId, or name
            const parentDog = this.findParentDog(parentId, season.exhausted);

            if (parentDog && parentDog.collected !== undefined) {
                const dogName = parentDog.name;
                // Inscribe the parent's plunder as a global variable in the context
                contextObj[dogName] = parentDog.collected;
                this.requiredYieldsContext.set(dogName, parentDog.collected);
                // Debug: log fer SerializedDog parents
                if (parentDog instanceof SerializedDog) {
                    console.log(`[SerializedDog ${this.storageId}] Füge ${dogName} (storageId: ${(parentDog as SerializedDog<unknown>).storageId}) zum Context hinzu`);
                }
            } else if (parentDog && parentDog.collected === undefined) {
                console.warn(`[SerializedDog ${this.storageId}] Parent ${parentId} gefunden, aber collected ist undefined`);
            } else {
                console.warn(`[SerializedDog ${this.storageId}] Parent ${parentId} nicht in exhausted gefunden`);
            }
        });

        this.applyVmGlobalsSuppliers(contextObj, season.exhausted);

        // Debug: log all exhausted dogs and context keys
        console.log(`[SerializedDog ${this.storageId}] Required/Optional Parent IDs:`, allParentIds);
        console.log(`[SerializedDog ${this.storageId}] Context keys vor createContext:`, Object.keys(contextObj));

        // Create the VM context AFTER all variables are inscribed --
        // IMPORTANT: all variables must be set BEFORE createContext or they vanish into the void!
        const context = vm.createContext(contextObj);

        // Debug: verify variables survived the crossing into the VM realm
        console.log(`[SerializedDog ${this.storageId}] Context keys nach createContext:`, Object.keys(context));

        // The script -- the spirit's incantation, ready to execute
        const script = new vm.Script(wrappedCode);

        try {
            const result = await script.runInContext(context);
            return result as T;
        } catch (err: any) {
            //TODO: Provide proper errors to UI -- the void's messages deserve better presentation
            console.error("Script Error:", err);
            return ("Error: " + err.message) as T
        }
    }


}
