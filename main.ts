import { DishFlagBlackLab } from './dogs/DishFlagBlackLab';
import { IHuntingDog, IHuntingDog as IDog } from "./core/enities/IHuntingDog"
import { IHuntingSeason } from "./core/enities/IHuntingSeason"
import { RandomRecipesRetriever } from "./dogs/RandomRecipesRetriever";
import { CountryFlagBlackLab } from "./dogs/CountryFlagBlackLab";
import { AsciiArt, AsciiPrinter } from './AsciiPrinter';
import { RandomEveryThingRetriever } from './dogs/RandomEverthingRetriever';
import { writeFileSync } from 'fs';



// function to collect data
const mainDataDogs:()=>Promise<unknown> = () => {
    return new Promise(async (res, rej) => {
        // init hunting dogs
        const kennel: Array<IDog<unknown>> = [
            new RandomRecipesRetriever(), 
            new CountryFlagBlackLab(), 
            new DishFlagBlackLab(), 
            new RandomEveryThingRetriever(), 
            //new FoodPornRetriever(), // deactivated to much requests for this api key
            new TalkingDog() ,
            new SerializedDog({
                theRun:`
    const response = await fetch("https://dummyjson.com/recipes");
    const json = await response.json()
    const retrive = RandomRecipesRetriever.difficulty
    return retrive;
`
            })
        ]


        let hunt = new SeasonRunner({
            kennel
        })

        let theHunt = await hunt.run();

        console.log(theHunt);

        let storyDog = theHunt.exhausted.find(dog => dog instanceof TalkingDog)
        //writeFileSync("./TalkingDogDump.html", storyDog?.collected ?? "no dog there");
        //res(storyDog?.collected)

        let waves: Waves = []
        theHunt.wave.forEach(wave => {
            waves.push(wave.map(i => {
                let dog= {                    id:i.instance.name,
                    name:i.instance.name,
                    result:i.instance.collected,
                    parentsOptional:[...i.optionalRequiresFrom? i.optionalRequiresFrom.map(i => i.instance.name) : []],
                    parentsRequired:[...i.requiresFrom? i.requiresFrom.map(i => i.instance.name) : []],
                }

                if (i instanceof SerializedDog){
                    
                }

                return dog;

            }))
        })

        let html = Results.buildWavesHtml(waves)
        res(html)

    })
}





import express from "express";
import { FoodPornRetriever } from './dogs/FoodPornRetriever';
import { TalkingDog } from './dogs/TalkingDogs/TalkingDog';
import { SeasonRunner } from './core/harverster';
import { Results, Waves } from './results';
import { SerializedDog } from './dogs/SerializedDog';

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