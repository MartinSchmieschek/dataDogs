import { DishFlagBlackLab } from './dogs/DishFlagBlackLab';
import { IHuntingDog, IHuntingDog as IDog } from "./enities/IHuntingDog"
import { IHuntingSeason } from "./enities/IHuntingSeason"
import { RandomRecipesRetriever } from "./dogs/RandomRecipesRetriever";
import { CountryFlagBlackLab } from "./dogs/CountryFlagBlackLab";
import { MbdhDogExample } from './mbdhEnrichShit/mbdhDogs/MbdhEampleDog';
import { AsciiArt, AsciiPrinter } from './AsciiPrinter';
import { ResuractedMBDHDogBase } from './mbdhEnrichShit/resuractedMBDHDogBase';
import { RandomEveryThingRetriever } from './dogs/RandomEverthingRetriever';
import { TalkingDog } from './dogs/TalkingDog/TalkingDog';
import { writeFileSync } from 'fs';



// function to collect data
const mainDataDogs:()=>Promise<unknown> = () => {
    return new Promise((res, rej) => {
        // init hunting dogs
        const kennel: Array<IDog<unknown>> = [new RandomRecipesRetriever(), new CountryFlagBlackLab(), new DishFlagBlackLab(), new RandomEveryThingRetriever(), new TalkingDog()]

        // for fun try to convert mbdh enrichment class into a dog
        const mbdhSubject = {};
        const mbdhContext = {};
        const chatter = [] as any
        kennel.push(new MbdhDogExample(mbdhSubject, mbdhContext, chatter))

        AsciiPrinter.print(AsciiArt.Box, "")
        kennel.forEach(dog => AsciiPrinter.print((dog instanceof ResuractedMBDHDogBase) ? AsciiArt.Zombie : AsciiArt.Cat, "<" + dog.name + ">"))
        // just trigger everyOne
        const dogsWithBeesInthePants = Object.assign([], kennel) as Array<IDog<unknown>>;

        // things to do:
        const letOut = async (dog: IHuntingDog<unknown>) => {
            try {
                console.log("<" + dog.name + ">" + " is running.")
                await dog.collectYield(season);
                season.exhausted.push(dog)


                // be happy about one more exausted dog
                let dogIndex = dogsWithBeesInthePants.findIndex(comperrator => comperrator === dog)
                if (dogIndex >= 0) {
                    console.log("<" + dog.name + ">" + " is now exausted.")
                    dogsWithBeesInthePants.splice(dogIndex, 1)
                }

            }
            catch (e) {
                console.warn("Hunt failed. Name:" + "<" + dog.name + ">", e)
            }
        }

        const letOutThePack = async (pack: IHuntingDog<unknown>[]) => {
            console.log("Let out the pack of: " + pack.map(dog => "<" + dog.name + ">").join(","))
            await Promise.all(pack.map(dog => letOut(dog)));
        }

        console.log("dog with bees in the pants:" + dogsWithBeesInthePants.map(dog => "<" + dog.name + ">").join(", "))

        // lets the data season begin with nothing :D
        const season: IHuntingSeason = {
            exhausted: [],
        } = {
            exhausted: [],
        }



        AsciiPrinter.print(AsciiArt.StartLine, "")
        // go gether something
        const firstHunt = dogsWithBeesInthePants.filter((dog) => { return dog.isReady(season) })

        if (firstHunt.length === 0)
            throw console.warn("Nothing to harvest, check your kennel! You need more dogs to be prepared to get your yield.");

        // go explore
        letOutThePack(firstHunt).then(async () => {
            let wave = 1;
            const maxWaves = kennel.length;

            // prepare all other runs
            let seasonRuns: (() => Promise<void>)[] = []
            for (let i = 0; i < maxWaves; i++) {
                wave++;
                seasonRuns.push(
                    async () => {
                        let leftoverDogs = dogsWithBeesInthePants.filter(dog => dog.isReady(season));
                        if (leftoverDogs.length > 0) {
                            await letOutThePack(leftoverDogs)
                        }
                        else {
                            console.log("no more dogs withe bees int the pants.")
                            i = maxWaves;
                        }
                    }
                );
            }

            // make the season runs
            for await (const run of seasonRuns) {
                await run();
            }

            // report
            AsciiPrinter.print(AsciiArt.Treasure, "")
            season.exhausted.forEach(dog => {
                AsciiPrinter.print(AsciiArt.Dog, "<" + dog.name + ">")
                console.log(dog.collected)

            })

            // dump
            let storyDog = season.exhausted.find(dog => dog instanceof TalkingDog)
            //writeFileSync("./TalkingDogDump.html", storyDog?.collected ?? "no dog there");
            res(storyDog?.collected)
        })

    })
}





import express from "express";

const app = express();
const port = 3000;

// einfache Route
app.get("/", (req, res) => {
    let dogs = mainDataDogs()
    dogs.then((d) => {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.send(d);
    })
});

console.log("App started.")
// Server starten
app.listen(port, () => {
    console.log(`✅ Server läuft auf http://localhost:${port}`);
});