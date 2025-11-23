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
            new TalkingDog() 
        ]


        let hunt = new Harvester({
            kennel
        })

        let theHunt = await hunt.run();

        console.log(theHunt);

        let storyDog = theHunt.exhausted.find(dog => dog instanceof TalkingDog)
        //writeFileSync("./TalkingDogDump.html", storyDog?.collected ?? "no dog there");
        //res(storyDog?.collected)

        let waves: Array<Array<{ name: string; result: any }>> = []
        theHunt.wave.forEach(wave => {
            waves.push(wave.map(i => {
                return{
                    name:i.name,
                    result:i.collected
                }
            }))
        })

        let html = Results.createWaveHTML(waves)
        res(html)

    })
}





import express from "express";
import { FoodPornRetriever } from './dogs/FoodPornRetriever';
import { TalkingDog } from './dogs/TalkingDogs/TalkingDog';
import { Harvester } from './core/harverster';
import { Results } from './results';

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