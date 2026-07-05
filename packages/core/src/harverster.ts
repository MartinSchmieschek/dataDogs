/**
 * ~~~ THE HUNT -- WAVE BY WAVE INTO THE ABYSS ~~~
 *
 * Arr, the SeasonRunner be the hunt itself -- the relentless pursuit
 * that drives hounds forth in waves, each wave more desperate than the last.
 * In luminous space blackened stars, they gaze, accuse, deny --
 * and still the hounds run, wave after wave, until all be exhausted
 * or the void swallows what remains.
 *
 * Roiling, moaning, this realm of ours, in madness lost shall die.
 */

import { Dog } from "./core/entities/abstractHuntingDog";
import { IHuntingDog } from "./core/entities/IHuntingDog";
import { IHuntingSeason } from "./core/entities/IHuntingSeason";
import { isRuntimeLogVerbose } from "./runtimeLog";



/**
 * Arr, the SeasonRunner -- the relentless hunt itself, driving hounds forth wave by wave
 * into the roiling abyss. In luminous space blackened stars, they gaze, accuse, deny --
 * and still the hounds run until all be exhausted or the void swallows what remains.
 * Corporeal laws are unwritten as this engine of eldritch reckoning orchestrates
 * the carrion hordes through each successive wave of data plundering.
 */
export class SeasonRunner {
    // The kennel -- all hounds aboard this cursed vessel
    private kennel: Array<IHuntingDog<unknown>> = [

    ]

    // Hounds still restless, eager to run -- bees in their pants, fire in their void-touched eyes
    private dogsWithBeesInthePants: Array<IHuntingDog<unknown>> = []

    // The season log -- our anchor of progression through the roiling madness
    private season: IHuntingSeason

    /**
     * Summon the hunt into existence -- provision it with a kennel of hounds
     * and prepare the season log fer the dark voyage ahead.
     * @param options - The summoning rite's parameters, containing the kennel of hounds to unleash
     */
    constructor(options: {
        kennel: Array<IHuntingDog<unknown>>
    }) {

        this.kennel = options.kennel.length > 0 ? options.kennel : [];

        this.dogsWithBeesInthePants = Object.assign([], this.kennel) as Array<IHuntingDog<unknown>>;

        this.season = {
            exhausted: [],
            withBeesInThePants: this.dogsWithBeesInthePants,
            maxRuns: this.maxWaves,
            runIndex: 0,
            wave:[],
            readTracking: [],
            currentWaveIndex: 0
        }
    }

    // The maximum waves before the hunt ends -- one per hound, fer the abyss grants no more
    private get maxWaves() {
        return this.kennel.length
    };

    // Release a single hound into the void -- let it hunt, let it collect, let it collapse exhausted
    private async letOut (dog: IHuntingDog<unknown>, season: IHuntingSeason):Promise<void> {
        const v = isRuntimeLogVerbose();
        try {
            if (v) console.log("<" + dog.name + ">" + " is running.")
            await dog.collectYield(season);
            season.exhausted.push(dog)


            // Arr, one more hound spent -- strike it from the restless crew
            let dogIndex = this.dogsWithBeesInthePants.findIndex(comperrator => comperrator === dog)
            if (dogIndex >= 0) {
                if (v) console.log("<" + dog.name + ">" + " is now exausted.")
                this.dogsWithBeesInthePants.splice(dogIndex, 1)
            }

        }
        catch (e) {
            if (v) {
                const msg = e instanceof Error ? e.message : String(e);
                console.warn(`Hunt failed. Name: <${dog.name}> — ${msg}`);
            }
            // The hunt has failed -- store the horror in the dog's error brand
            (dog as any).__error = e instanceof Error ? e.message : String(e);
            // Add the dog to exhausted regardless -- even failed hunts leave their mark
            season.exhausted.push(dog);
            // Strike it from the restless crew, for it shall run no more
            let dogIndex = this.dogsWithBeesInthePants.findIndex(comperrator => comperrator === dog)
            if (dogIndex >= 0) {
                this.dogsWithBeesInthePants.splice(dogIndex, 1)
            }
        }
    }

    // Release the whole pack at once -- a wave crashing into the unknown
    private async letOutThePack (pack: IHuntingDog<unknown>[], season: IHuntingSeason):Promise<void> {
        const v = isRuntimeLogVerbose();
        // Mark the current wave index based on how many waves have already crashed upon the void
        const currentWaveIndex = season.wave.length;
        season.currentWaveIndex = currentWaveIndex;

        if (v) console.log("Let out the pack of: " + pack.map(dog => "<" + dog.name + ">").join(","))
        await Promise.all(pack.map(dog => this.letOut(dog, season)));

        // Record every hound that returned from the deep -- even those bearing eldritch errors
        let i = this.season.wave.push(pack.filter(dog => {
            return dog.collected != undefined || (dog as any).__error != undefined;
        }).map(i => {return {
            instance:i,
            optionalRequiresFrom:null,
            requiresFrom:null
        }}))

        // The Void's tally — one breath per wave: how many hounds returned, how many were lost.
        const failed = pack.filter(d => (d as any).__error != undefined).length;
        const ok = pack.length - failed;
        if (v) console.log(`<wave ${currentWaveIndex + 1}> ${pack.length} dogs · ${ok} ok · ${failed} fail`);

        this.season.wave[i-1].forEach(i => {
            let baseDog = i.instance as Dog<unknown>
            if (baseDog && baseDog.filterByRequirements != undefined){
                let possibleSources = baseDog.filterByRequirements(this.season.exhausted)
                i.optionalRequiresFrom = possibleSources.optional,
                i.requiresFrom = possibleSources.required
            }

        })
    }

    /**
     * Run the hunt -- the full season, wave by wave, until all hounds be spent
     * or the abyss has nothing more to yield. To cosmic madness laws submit,
     * though stalwart minds entreat.
     */
    public async run():Promise<IHuntingSeason> {
        const v = isRuntimeLogVerbose();

        if (v) console.log("dog with bees in the pants:" + this.dogsWithBeesInthePants.map(dog => "<" + dog.name + ">").join(", "))

        // The first wave -- only hounds that be ready may venture forth
        const firstHunt = this.dogsWithBeesInthePants.filter((dog) => { return dog.isReady(this.season) })

        if (firstHunt.length === 0) {
            if (v) console.warn("Nothing to harvest, check your kennel! You need more dogs to be prepared to get your yield.");
            throw new Error("Nothing to harvest, check your kennel! You need more dogs to be prepared to get your yield.");
        }

        // Into the deep, matey -- wave after wave until the void yields no more
        await this.letOutThePack(firstHunt, this.season).then(async () => {
            let wave = 1;


            // Prepare the remaining waves -- each one deeper into the cosmic madness
            let seasonRuns: (() => Promise<void>)[] = []
            for (let i = 0; i < this.maxWaves; i++) {
                wave++;
                this.season.runIndex = wave;
                seasonRuns.push(
                    async () => {
                        let nextPack = this.dogsWithBeesInthePants.filter(dog => dog.isReady(this.season));
                        if (nextPack.length > 0) {
                            await this.letOutThePack(nextPack, this.season)
                        }
                        else {
                            if (v) console.log("no more dogs withe bees int the pants.")
                            i = this.maxWaves;
                        }
                    }
                );
            }

            // Execute the season -- wave by wave, deeper into the roiling abyss
            for await (const run of seasonRuns) {
                await run();
            }

            // The hunt is done -- the spoils stay sealed in the season log
            // (season.exhausted[i].collected) fer those who wish to read; no soul cares to see them spilled.

            return (this.season)
        })

        return this.season
    }
}
