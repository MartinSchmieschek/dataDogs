import { TypeDefBuilder } from './ui/TypeDefBuilder';
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
import { ISerializedDogConfig, SerializedDog } from './dogs/SerializedDog';
import { NodeEntry, Results, Waves } from './ui/results';
import { KennelRun } from './core/KennelRun';
import { Controller } from './api/Controller';
import { ControllerRegistry, ConfigRouteHandler } from './core/routes/ConfigRouteHandler';
import { IKennelConfig } from './core/KennelRun';

// ENTRY: start wird als erstes aufgerufen beim Programmstart
start().catch(e => {
    console.error('Failed to start', e);
    process.exit(1);
});

async function start() {
    const dbUrl = process.env.DATABASE_URL ?? 'file:./dev.db';
    
    // Separate Store-Instanzen für Nodes und Kennels
    const nodesStore: IStore = new PrismaStore(dbUrl);
    const kennelsStore: IStore = new PrismaStore(dbUrl);
    
    // Init Stores
    if ((nodesStore as any).init) await (nodesStore as any).init();
    if ((kennelsStore as any).init) await (kennelsStore as any).init();

    // Seed: Ensure at least one SerializedDog exists in DB
    const nodeSeeds = await nodesStore.findByType(SerializedDog.name);
    if (!nodeSeeds || nodeSeeds.length === 0) {
        const seedCfg = {
            theRun: `
                const response = await fetch("https://dummyjson.com/recipes");
                const json = await response.json();
                const retrive = RandomRecipesRetriever.difficulty;
                return retrive;
                `,
            version: 1,
        } as ISerializedDogConfig;

        await nodesStore.save({ id: 'seed-serialized-1-v1', type: SerializedDog.name, serializedDogConfig: seedCfg });
        console.log('✅ Seeded initial SerializedDog into DB');
    }

    // Seed: Ensure at least one Kennel-Config exists in DB
    const kennelSeeds = await kennelsStore.findByType('KennelConfig');
    if (!kennelSeeds || kennelSeeds.length === 0) {
        const defaultKennelConfig: IKennelConfig = {
            id: 'default-kennel',
            name: 'Default Kennel',
            description: 'Standard-Kennel mit allen verfügbaren Dogs',
            dogIds: [],
            baseDogTypes: ['RandomRecipesRetriever', 'CountryFlagBlackLab', 'DishFlagBlackLab', 'RandomEveryThingRetriever', 'TalkingDog'],
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await kennelsStore.save({ 
            id: defaultKennelConfig.id, 
            type: 'KennelConfig', 
            serializedDogConfig: JSON.stringify(defaultKennelConfig) 
        });
        console.log('✅ Seeded initial Kennel-Config into DB');
    }

    const app = express();
    const port = 3000;

    app.use(express.json());

    // Controller-Registry erstellen und Controller registrieren
    const registry = new ControllerRegistry();
    registry.register('nodes', new Controller<ISerializedDogConfig>(nodesStore, SerializedDog.name));
    registry.register('kennels', new Controller<IKennelConfig>(kennelsStore, 'KennelConfig'));

    // Generisches Route-System registrieren
    const routeHandler = new ConfigRouteHandler(registry);
    routeHandler.registerRoutes(app, '/api');

    // Einfache Route (für UI)
    app.get('/', async (req: any, res: any) => {
        try {
            // Lade die geseedete Kennel-Config
            const defaultKennelData = await kennelsStore.load('default-kennel');
            let kennelConfig: IKennelConfig | undefined;
            
            if (defaultKennelData) {
                kennelConfig = typeof defaultKennelData === 'string' 
                    ? JSON.parse(defaultKennelData) 
                    : defaultKennelData;
                console.log(`[main] Geladene Kennel-Config:`, JSON.stringify(kennelConfig, null, 2));
            } else {
                console.log(`[main] Keine Kennel-Config gefunden`);
            }
            
            // Erstelle KennelRun mit der Config (falls vorhanden)
            const kennelRun = kennelConfig 
                ? new KennelRun(nodesStore, kennelConfig)
                : new KennelRun(nodesStore);
            
            const waves = await kennelRun.run();
            const html = Results.buildWavesHtml(waves);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(html);
        } catch (err) {
            console.error(err);
            res.status(500).send(String(err));
        }
    });


    console.log('App started.');
    app.listen(port, () => {
        console.log(`✅ Server läuft auf http://localhost:${port}`);
    });
}

// Die Funktionen fillKennel und runSeason wurden in die KennelRun Klasse verschoben
// Siehe: core/KennelRun.ts

// Die API-Controller sind im api/ Ordner
// Siehe: api/Controller.ts, api/AbstractController.ts


