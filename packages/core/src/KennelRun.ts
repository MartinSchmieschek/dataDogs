/**
 * ~~~ THE CAPTAIN WHO FILLS THE KENNEL AND RUNS THE HUNT ~~~
 *
 * Arr, this be the KennelRun -- the captain of our cursed vessel.
 * It fills the kennel with hounds summoned from the deep,
 * stitches together base-dogs and serialized spirits,
 * and unleashes the hunt across waves of eldritch reckoning.
 *
 * Its heralds are the stars it fells, the sky and Earth aflame.
 * When the captain speaks, every hound answers -- or is consumed by the void.
 */

import { IHuntingDog as IDog } from './core/entities/IHuntingDog';
import { SerializedDog, type SerializedDogVmGlobalsSupplier } from './dogs/SerializedDog';
import { MimicDog, IMimicDogConfig } from './dogs/MimicDog';
import { SeasonRunner } from './harverster';
import { IHuntingSeason } from './core/entities/IHuntingSeason';

/**
 * Arr, this prefix brands a dog as a base-class hound in the dogIds manifest.
 * Like a brand seared by void-flame, it marks the original crew.
 */
export const BASE_DOG_PREFIX = 'base:';

/**
 * The kennel's cursed charter -- what hounds dwell within, and what dark purpose binds them.
 * Base-dogs be branded with the "base:" sigil in dogIds (e.g. "base:RandomRecipesRetriever").
 * SerializedDogs sail under their GUID — a version ID (exact incarnation) or dogId (latest incarnation).
 */
export interface IKennelConfig {
    /** The kennel's unique identifier -- its brand seared by void-flame into the registry */
    id: string;
    /** A mortal-readable name fer this kennel -- a whisper of sanity amidst the eldritch dark */
    name?: string;
    /** A description of the kennel's dark purpose -- what plunder it seeks from the abyss */
    description?: string;
    /** An emoji sigil fer the kennel -- a glyph to mark it in the UI, should ye dare look */
    emoji?: string;
    /** Arr of dog IDs that crew this kennel: SerializedDogs (version GUID or dogId GUID) or base-dogs (e.g. "base:RandomRecipesRetriever") */
    dogIds: string[];
    /** Default query parameters fer the editor -- the map's starting coordinates, drawn before we sail */
    defaultQuery?: Record<string, string>;
    /** Default body data fer the editor -- the cargo manifest, pre-loaded into the hold */
    defaultBody?: any;
    /** When this kennel was first conjured from the void */
    createdAt?: Date;
    /** When this kennel last felt the touch of mortal hands */
    updatedAt?: Date;
}

/**
 * The KennelRun -- captain of the hunt, orchestrator of the abyss.
 * Corporeal laws are unwritten as suns and love retreat;
 * this class fills the kennel with hounds and drives them forth
 * into the roiling madness of the data-season.
 */
export class KennelRun {
    private config?: IKennelConfig;
    private baseDogClasses: Map<string, new () => IDog<unknown>>;
    private serializedDogFactory: (ids: string[]) => Promise<Array<SerializedDog<unknown>>>;
    private queryData?: Record<string, string>;
    private bodyData?: any;
    private vmGlobalsSuppliers: SerializedDogVmGlobalsSupplier[];

    /**
     * Summon the captain and provision the vessel.
     * @param configOrBaseDogs - The kennel charter, or a raw crew of hounds (rarely used, that path be cursed)
     * @param baseDogClasses - Map of base-dog names to their constructors. Needed to conjure fresh hounds
     *                        from config strings (e.g. "base:RandomRecipesRetriever"). New instances every
     *                        fillKennel() call -- no cached spirits linger aboard this vessel.
     * @param serializedDogFactory - A factory that dredges SerializedDogs from the deep by their IDs.
     * @param queryData - Query parameters fer the QueryRetriever (the map-reader)
     * @param bodyData - Body data fer the BodyRetriever (the cargo-bearer)
     * @param vmGlobalsSuppliers - App-specific VM globals (e.g. Pact enums); the core knows no concrete forms.
     */
    constructor(
        configOrBaseDogs?: IKennelConfig | Array<IDog<unknown>>,
        baseDogClasses: Map<string, new () => IDog<unknown>> = new Map(),
        serializedDogFactory: (ids: string[]) => Promise<Array<SerializedDog<unknown>>> = async () => [],
        queryData?: Record<string, string>,
        bodyData?: any,
        vmGlobalsSuppliers: SerializedDogVmGlobalsSupplier[] = []
    ) {
        this.baseDogClasses = baseDogClasses;
        this.serializedDogFactory = serializedDogFactory;
        this.queryData = queryData;
        this.bodyData = bodyData;
        this.vmGlobalsSuppliers = vmGlobalsSuppliers;

        if (configOrBaseDogs && !Array.isArray(configOrBaseDogs)) {
            // Arr, 'tis a proper charter -- anchor it to the captain
            this.config = configOrBaseDogs;
            console.log(`[KennelRun.constructor] Config geladen:`, JSON.stringify(this.config, null, 2));
        }
    }

    /**
     * Fill the kennel with hounds summoned from the abyss.
     * Loads SerializedDogs from the deep and combines them with base-dog spirits.
     * Base-dogs be conjured from dogIds bearing the "base:" brand.
     * SerializedDogs be dredged by their unbranded IDs.
     * - If a GUID matches a version ID, that exact incarnation is summoned
     * - If a GUID matches a dogId, the newest incarnation of that lineage rises from the deep
     */
    public async fillKennel(): Promise<Array<IDog<unknown>>> {
        console.log(`[KennelRun.fillKennel] Start`);
        console.log(`[KennelRun.fillKennel] Config vorhanden:`, this.config ? JSON.stringify(this.config, null, 2) : 'keine');

        const kennel: Array<IDog<unknown>> = [];

        // Separate the branded base-dogs from the serialized spirits
        const dogIds = this.config?.dogIds || [];
        const baseDogIds = dogIds.filter(id => id.startsWith(BASE_DOG_PREFIX));
        const serializedDogIds = dogIds.filter(id => !id.startsWith(BASE_DOG_PREFIX));

        console.log(`[KennelRun.fillKennel] Gefunden: ${baseDogIds.length} Basis-Dogs, ${serializedDogIds.length} SerializedDogs in dogIds`);

        // Conjure fresh base-dog instances -- always new, never cached, lest old spirits haunt us
        baseDogIds.forEach(baseDogId => {
            const typeName = baseDogId.substring(BASE_DOG_PREFIX.length);
            const BaseDogClass = this.baseDogClasses.get(typeName);
            if (BaseDogClass) {
                let baseDog: IDog<unknown>;
                if (typeName === 'QueryRetriever') {
                    baseDog = new (BaseDogClass as any)(this.queryData || {});
                } else if (typeName === 'BodyRetriever') {
                    baseDog = new (BaseDogClass as any)(this.bodyData);
                } else {
                    baseDog = new BaseDogClass();
                }
                kennel.push(baseDog);
                console.log(`[KennelRun.fillKennel] Erstellt neue Basis-Dog-Instanz: ${typeName}`);
            } else {
                console.warn(`[KennelRun.fillKennel] Unbekannter Basis-Dog-Typ: ${typeName}`);
            }
        });

        // Dredge SerializedDogs from the abyss if any be named in the charter
        if (serializedDogIds.length > 0) {
            console.log(`[KennelRun.fillKennel] Lade ${serializedDogIds.length} SerializedDogs (GUIDs → Factory resolves version or dogId)`);

            // Use the factory to raise serialized spirits from the deep
            const serializedDogs = await this.serializedDogFactory(serializedDogIds);
            console.log(`[KennelRun.fillKennel] Factory erstellt ${serializedDogs.length} SerializedDogs`);

            serializedDogs.forEach(dog => {
                kennel.push(dog);
                console.log(`[KennelRun.fillKennel] SerializedDog hinzugefügt: ${dog.storageId}`);
            });
        }

        // Bind every serialized spirit to the kennel so they may find their kin
        kennel.forEach(dog => {
            if (dog instanceof SerializedDog) {
                (dog as SerializedDog<unknown>).setKennelRef(kennel);
            }
        });

        // Resolve the shapeshifters' borrowed forms and fulfil unmet pact-requirements
        kennel.forEach(dog => {
            if (dog instanceof MimicDog) {
                (dog as MimicDog<unknown>).resolveImitates(this.baseDogClasses);
            }
        });

        await this.autoMimic(kennel);

        if (this.vmGlobalsSuppliers.length > 0) {
            kennel.forEach(dog => {
                if (dog instanceof SerializedDog) {
                    (dog as SerializedDog<unknown>).setVmGlobalsSuppliers(this.vmGlobalsSuppliers);
                }
            });
        }

        const baseDogsCount = baseDogIds.length;
        const serializedDogsCount = kennel.length - baseDogsCount;
        console.log(`[KennelRun.fillKennel] Kennel gefüllt mit ${kennel.length} Dogs (${baseDogsCount} baseDogs + ${serializedDogsCount} SerializedDogs)`);
        return kennel;
    }

    /**
     * Auto-Mimic -- the eldritch rite that conjures shapeshifters to fill empty pacts.
     * Carrion hordes trill their profane accord with eldritch plans:
     * - Pact dependency with no real dog --> summon a MimicDog (with saved code if it exists in the deep)
     * - Required non-pact missing --> conjure a BaseDog from the class registry
     * - Optional non-pact missing --> ignore it (areOptionalParentsReady handles the silence)
     * - Real dog AND mimic for the same class --> cast the mimic overboard
     */
    private async autoMimic(kennel: Array<IDog<unknown>>): Promise<void> {
        const requiredClasses = new Set<new (...args: any[]) => IDog<unknown>>();
        const allDependencyClasses = new Set<new (...args: any[]) => IDog<unknown>>();

        for (const dog of kennel) {
            if ('required' in dog && Array.isArray((dog as any).required)) {
                for (const reqClass of (dog as any).required) {
                    requiredClasses.add(reqClass);
                    allDependencyClasses.add(reqClass);
                }
            }
            if ('optional' in dog && Array.isArray((dog as any).optional)) {
                for (const optClass of (dog as any).optional) {
                    allDependencyClasses.add(optClass);
                }
            }
        }

        const pactsNeedingMimic: Array<new (...args: any[]) => IDog<unknown>> = [];

        for (const depClass of allDependencyClasses) {
            const isPact = (depClass as any).__isPact === true;
            const hasMimic = kennel.some(d =>
                d instanceof MimicDog && (d as MimicDog<unknown>).imitatesClasses.includes(depClass)
            );
            const hasReal = kennel.some(d =>
                !(d instanceof MimicDog) && d instanceof depClass
            );

            if (hasReal && hasMimic) {
                const mimicIdx = kennel.findIndex(d =>
                    d instanceof MimicDog && (d as MimicDog<unknown>).imitatesClasses.includes(depClass)
                );
                if (mimicIdx >= 0) {
                    console.log(`[KennelRun.autoMimic] Echter Dog vorhanden, entferne Mimic fuer ${depClass.name}`);
                    kennel.splice(mimicIdx, 1);
                }
                continue;
            }

            if (hasReal || hasMimic) continue;

            if (isPact) {
                pactsNeedingMimic.push(depClass);
            } else if (requiredClasses.has(depClass)) {
                const BaseDogClass = this.baseDogClasses.get(depClass.name);
                if (BaseDogClass) {
                    const baseDog = new BaseDogClass();
                    kennel.push(baseDog);
                    console.log(`[KennelRun.autoMimic] Auto-erstellt BaseDog '${depClass.name}' (required)`);
                }
            }
        }

        if (pactsNeedingMimic.length === 0) return;

        // Always conjure fresh mimics — never reuse saved ones from the deep.
        // Each mimic is a placeholder; the user's code lives in the SerializedDog they write.
        for (const depClass of pactsNeedingMimic) {
            const mimicConfig: IMimicDogConfig = {
                theRun: `throw new Error("MimicDog for '${depClass.name}' needs user code");`,
                imitates: depClass.name,
                displayName: `auto-mimic-${depClass.name}`,
            };

            const mimic = new MimicDog<unknown>(mimicConfig, `auto-mimic-${depClass.name}`);
            mimic.resolveImitates(this.baseDogClasses);
            mimic.setKennelRef(kennel);
            kennel.push(mimic);
            console.log(`[KennelRun.autoMimic] Frischen MimicDog erstellt fuer Pact '${depClass.name}'`);
        }
    }

    /**
     * Unleash the hunt across waves of cosmic reckoning.
     * Roiling, moaning, this realm of ours, in madness lost shall die.
     * @param kennel - The crew of hounds; if none be given, fillKennel() summons them from the deep
     * @returns The season log -- a record of every wave, every exhausted hound
     */
    public async runSeason(kennel?: Array<IDog<unknown>>): Promise<IHuntingSeason> {
        // If no kennel was provided, summon the crew from the abyss
        if (!kennel) {
            kennel = await this.fillKennel();
        }

        const hunt = new SeasonRunner({ kennel });
        const theHunt = await hunt.run();

        console.log(theHunt);

        return theHunt;
    }

    /**
     * Execute the full voyage -- fill the kennel, then run the season.
     * From bow to stern, from summoning to exhaustion. Arr.
     * @returns The season log with all results plundered from the void
     */
    public async run(): Promise<IHuntingSeason> {
        const kennel = await this.fillKennel();
        return await this.runSeason(kennel);
    }

}
