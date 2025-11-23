import { promises } from "dns";
import { IHuntingDog } from "./enities/IHuntingDog";
import { IHuntingSeason } from "./enities/IHuntingSeason";

export class Harvester {
    private kennel: Array<IHuntingDog<unknown>> = [

    ]

    // just trigger everyOne
    private dogsWithBeesInthePants: Array<IHuntingDog<unknown>> = []

    // lets the data season begin with nothing :D this will change over time, this is our progression anchor
    private season: IHuntingSeason

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
            wave:[]
        }
    }

    private get maxWaves() {
        return this.kennel.length
    };

    // things to do:
    private async letOut (dog: IHuntingDog<unknown>, season: IHuntingSeason):Promise<void> {
        try {
            console.log("<" + dog.name + ">" + " is running.")
            await dog.collectYield(season);
            season.exhausted.push(dog)


            // be happy about one more exausted dog
            let dogIndex = this.dogsWithBeesInthePants.findIndex(comperrator => comperrator === dog)
            if (dogIndex >= 0) {
                console.log("<" + dog.name + ">" + " is now exausted.")
                this.dogsWithBeesInthePants.splice(dogIndex, 1)
            }

        }
        catch (e) {
            console.warn("Hunt failed. Name:" + "<" + dog.name + ">", e)
        }
    }

    private async letOutThePack (pack: IHuntingDog<unknown>[], season: IHuntingSeason):Promise<void> {
        console.log("Let out the pack of: " + pack.map(dog => "<" + dog.name + ">").join(","))
        await Promise.all(pack.map(dog => this.letOut(dog, season)));
        this.season.wave.push(pack.filter(dog => dog.collected != undefined))
    }

    public async run():Promise<IHuntingSeason> {





        console.log("dog with bees in the pants:" + this.dogsWithBeesInthePants.map(dog => "<" + dog.name + ">").join(", "))




        // go gether something
        const firstHunt = this.dogsWithBeesInthePants.filter((dog) => { return dog.isReady(this.season) })

        if (firstHunt.length === 0)
            throw console.warn("Nothing to harvest, check your kennel! You need more dogs to be prepared to get your yield.");

        // go explore
        await this.letOutThePack(firstHunt, this.season).then(async () => {
            let wave = 1;


            // prepare all other runs
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
                            console.log("no more dogs withe bees int the pants.")
                            i = this.maxWaves;
                        }
                    }
                );
            }

            // make the season runs
            for await (const run of seasonRuns) {
                await run();
            }

            // report
            this.season.exhausted.forEach(dog => {
                console.log(dog.collected)
            })

            return (this.season)
        })

        return this.season
    }
}