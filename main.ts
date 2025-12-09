import { promises } from 'dns';
import { DishFlagBlackLab } from './dogs/DishFlagBlackLab';
import { IHuntingDog, IHuntingDog as IDog } from "./core/enities/IHuntingDog"
import { IHuntingSeason } from "./core/enities/IHuntingSeason"
import { RandomRecipesRetriever } from "./dogs/RandomRecipesRetriever";
import { CountryFlagBlackLab } from "./dogs/CountryFlagBlackLab";
import { AsciiArt, AsciiPrinter } from './AsciiPrinter';
import { RandomEveryThingRetriever } from './dogs/RandomEverthingRetriever';
import { writeFileSync } from 'fs';
import { IStore } from './store/IStore';
import { PrismaStore } from './store/PrismaStore';
import express from "express";
import { FoodPornRetriever } from './dogs/FoodPornRetriever';
import { TalkingDog } from './dogs/TalkingDogs/TalkingDog';
import { SeasonRunner } from './core/harverster';
//import { NodeEntry, Results, Waves } from './results';
import { ISerilizedDogConfig, SerializedDog } from './dogs/SerializedDog';
import { NodeEntry, Results, Waves } from './ui/results';
import { TypeDefBuilder } from './ui/TypeDefBuilder';

// ENTRY: start wird als erstes aufgerufen beim Programmstart
start().catch(e => {
    console.error('Failed to start', e);
    process.exit(1);
});

async function start() {
    const dbUrl = process.env.DATABASE_URL ?? 'file:./dev.db';
    const store: IStore = new PrismaStore(dbUrl);
    // init if available
    if ((store as any).init) await (store as any).init();

    // Ensure at least one SerializedDog seed exists in DB
    const seeds = await store.findByType(SerializedDog.name);
    if (!seeds || seeds.length === 0) {
        const seedCfg = {
            theRun: `
                const response = await fetch("https://dummyjson.com/recipes");
                const json = await response.json();
                const retrive = RandomRecipesRetriever.difficulty;
                return retrive;
                `,
        } as ISerilizedDogConfig;

        await store.save({ id: 'seed-serialized-1', type: SerializedDog.name, serilizedDogConfig: seedCfg });
        console.log('Seeded initial SerializedDog into DB');
    }

    const app = express();
    const port = 3000;

    app.use(express.json());

    // einfache Route
    app.get('/', async (req: any, res: any) => {
        try {
            const kennel = await fillKennel(store);
            const waves = await runSeason(kennel);
            const html = Results.buildWavesHtml(waves);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(html);
        } catch (err) {
            console.error(err);
            res.status(500).send(String(err));
        }
    });

    // einfache Route zum Speichern
    app.post('/api/saveSerilizedDog', async (req: any, res: any) => {
        try {
            await store.save(req.body);
            res.status(200).json({ ok: true });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: String(e) });
        }
    });

    console.log('App started.');
    app.listen(port, () => {
        console.log(`✅ Server läuft auf http://localhost:${port}`);
    });
}

// Füllt den Zwinger mit Hunden
async function fillKennel(store: IStore): Promise<Array<IDog<unknown>>> {
    const kennel: Array<IDog<unknown>> = [
        new RandomRecipesRetriever(),
        new CountryFlagBlackLab(),
        new DishFlagBlackLab(),
        new RandomEveryThingRetriever(),
        //new FoodPornRetriever(), // deactivated to much requests for this api key
        new TalkingDog(),
    ];

    // Lade SerializedDogs aus DB
    const toLoad = await store.findByType(SerializedDog.name);
    toLoad.forEach((sd: any) => {
        try {
            const dog = new SerializedDog(JSON.parse(sd.serilizedDogConfig),sd.id);
            kennel.push(dog);
        } catch (e) {
            console.error('Failed to load SerializedDog:', e);
        }
    });

    return kennel;
}

// Führt die Jagd/Wellen aus
async function runSeason(kennel: Array<IDog<unknown>>): Promise<Waves> {
    const hunt = new SeasonRunner({ kennel });
    const theHunt = await hunt.run();

    console.log(theHunt);

    // Baue Wellen-Struktur
    const waves: Waves = [];
    theHunt.wave.forEach((wave: any) => {
        // Remap Objects, that is no fun and schould be never done!
        waves.push(wave.map((entry: any) => {
            //create Waves dog entry 
            const nodeEntry = {
                id:entry.instance.name,  //:P will change the lining? (entry.instance instanceof SerializedDog) ? (entry.instance as SerializedDog<unknown>).storageId : entry.instance.name,
                name: entry.instance.name,
                result: entry.instance.collected,
                parentsOptional: [...entry.optionalRequiresFrom ? entry.optionalRequiresFrom.map((r: any) => r.instance.name) : []],
                parentsRequired: [...entry.requiresFrom ? entry.requiresFrom.map((r: any) => r.instance.name) : []],
            } as NodeEntry;

            // add additional codeTs if SerializedDog
            if (entry.instance instanceof SerializedDog) {
                const seDog = entry.instance as SerializedDog<unknown>;
                nodeEntry.codeTs = seDog.instanceConfig.theRun;
                nodeEntry.vmContext = seDog.simpleVmContext;
                let def = TypeDefBuilder.buildType("VMContext", seDog.simpleVmContext);
                nodeEntry.vmContextTypeDef = TypeDefBuilder.buildType("VMContext", seDog.simpleVmContext);
            }

            return nodeEntry;
        }));
    });

    return waves;
}


