import { DishFlagBlackLab } from './dogs/DishFlagBlackLab';
import { RandomRecipesRetriever } from "./dogs/RandomRecipesRetriever";
import { CountryFlagBlackLab } from "./dogs/CountryFlagBlackLab";
import { RandomEveryThingRetriever } from './dogs/RandomEverthingRetriever';
import { IStore } from './store/IStore';
import { PrismaStore } from './store/PrismaStore';
import express from "express";
import { TalkingDog } from './dogs/TalkingDogs/TalkingDog';
import { ISerializedDogConfig, SerializedDog } from './dogs/SerializedDog';
import { Results, Waves } from './ui/results';
import { KennelRun, IKennelConfig } from './core/KennelRun';
import { Controller } from './api/Controller';
import { ControllerRegistry, ConfigRouteHandler } from './api/routes/ConfigRouteHandler';
import { KennelList } from './ui/kennelList';
import { StartupTest } from './StartupTest';

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
    // Liste aller verfügbaren Basis-Dogs (durch Instanziierung)
    const allBaseDogs = [
        new RandomRecipesRetriever(),
        new CountryFlagBlackLab(),
        new DishFlagBlackLab(),
        new RandomEveryThingRetriever(),
        new TalkingDog()
    ];
    
    // Map von BaseDog-Namen zu Instanzen (für KennelRun)
    const baseDogsMap = new Map<string, any>();
    allBaseDogs.forEach(dog => {
        baseDogsMap.set(dog.name, dog);
    });
    
    const { BASE_DOG_PREFIX } = await import('./core/KennelRun');
    
    const kennelSeeds = await kennelsStore.findByType('KennelConfig');
    if (!kennelSeeds || kennelSeeds.length === 0) {
        // Erstelle dogIds mit allen Basis-Dogs
        const baseDogIds = allBaseDogs.map(dog => BASE_DOG_PREFIX + dog.name);
        console.log(`[Seed] Erstelle Kennel-Config mit ${baseDogIds.length} Basis-Dogs:`, baseDogIds);
        
        const defaultKennelConfig: IKennelConfig = {
            id: 'default-kennel',
            name: 'Default Kennel',
            description: 'Standard-Kennel mit allen verfügbaren Dogs',
            dogIds: baseDogIds,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await kennelsStore.save({ 
            id: defaultKennelConfig.id, 
            type: 'KennelConfig', 
            serializedDogConfig: JSON.stringify(defaultKennelConfig) 
        });
        console.log('✅ Seeded initial Kennel-Config into DB');
        console.log(`✅ Kennel-Config enthält ${baseDogIds.length} Basis-Dogs:`, baseDogIds);
    }

    const app = express();
    const port = 3000;

    app.use(express.json());

    // Controller-Registry erstellen und Controller registrieren
    const registry = new ControllerRegistry();
    const nodesController = new Controller<ISerializedDogConfig>(nodesStore, SerializedDog.name);
    const kennelsController = new Controller<IKennelConfig>(kennelsStore, 'KennelConfig', true);
    registry.register('nodes', nodesController);
    // Kennels haben Versionsverwaltung - beim Speichern wird eine neue Version erstellt
    registry.register('kennels', kennelsController);

    // Startup-Tests ausführen
    const startupTest = new StartupTest();
    await startupTest.runAllTests(
        nodesStore,
        kennelsStore,
        nodesController,
        kennelsController,
        baseDogsMap
    );

    // Generisches Route-System registrieren
    const routeHandler = new ConfigRouteHandler(registry);
    routeHandler.registerRoutes(app, '/api');

    // Route für Kennel-Liste (ohne ID)
    app.get('/kennel', async (req: any, res: any) => {
        try {
            const kennelsResult = await registry.get('kennels')?.list();
            const kennels = kennelsResult?.ok && kennelsResult.data 
                ? kennelsResult.data.map((k: any) => ({
                    id: k.id,
                    name: k.name,
                    description: k.description
                }))
                : [];
            
            const html = KennelList.buildKennelListHtml(kennels);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(html);
        } catch (err) {
            console.error(err);
            res.status(500).send(String(err));
        }
    });



    // Route für Root - zeigt Liste aller Kennels
    app.get('/', async (req: any, res: any) => {
        try {
            const kennelsResult = await registry.get('kennels')?.list();
            const kennels = kennelsResult?.ok && kennelsResult.data 
                ? kennelsResult.data.map((k: any) => ({
                    id: k.id,
                    name: k.name,
                    description: k.description
                }))
                : [];
            
            const html = KennelList.buildKennelListHtml(kennels);
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(html);
        } catch (err) {
            console.error(err);
            res.status(500).send(String(err));
        }
    });

    // Route für einzelne Kennel über Root-Path (/:kennelId)
    // Lädt immer die neueste Version der KennelConfig
    app.get('/:kennelId', async (req: any, res: any) => {
        try {
            const kennelId = req.params.kennelId;
            
            // Prüfe ob es eine API-Route ist (sollte nicht hier landen, aber sicherheitshalber)
            if (kennelId === 'api' || kennelId === 'kennel') {
                return; // Lass andere Routen das handhaben
            }
            
            // Lade neueste Version der Kennel-Config
            // findLatestVersionsByType gibt nur die neueste Version zurück
            const latestVersions = await kennelsStore.findLatestVersionsByType('KennelConfig', [kennelId]);
            
            let kennelConfig: IKennelConfig | undefined;
            
            if (latestVersions && latestVersions.length > 0) {
                const kennelData = latestVersions[0].serializedDogConfig;
                kennelConfig = typeof kennelData === 'string' 
                    ? JSON.parse(kennelData) 
                    : kennelData;
                console.log(`[main] Geladene Kennel-Config (neueste Version): ${kennelId}`, JSON.stringify(kennelConfig, null, 2));
            } else {
                // Fallback: Versuche direkt zu laden (falls keine Versionierung)
                const kennelData = await kennelsStore.load(kennelId);
                if (kennelData) {
                    kennelConfig = typeof kennelData === 'string' 
                        ? JSON.parse(kennelData) 
                        : kennelData;
                    console.log(`[main] Geladene Kennel-Config (direkt): ${kennelId}`, JSON.stringify(kennelConfig, null, 2));
                } else {
                    console.log(`[main] Kennel-Config ${kennelId} nicht gefunden`);
                    res.status(404).send(`Kennel ${kennelId} nicht gefunden`);
                    return;
                }
            }
            
            // Erstelle KennelRun mit der Config und der BaseDogs-Map
            const kennelRun = new KennelRun(nodesStore, kennelConfig, baseDogsMap);
            
            try {
                const waves = await kennelRun.run();
                const html = Results.buildWavesHtml(waves, kennelConfig);
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.send(html);
            } catch (runError: any) {
                // Prüfe ob es der "Nothing to harvest" Fehler ist
                const errorMessage = runError?.message || String(runError);
                if (errorMessage.includes("Nothing to harvest")) {
                    // Zeige Fehlerseite für leeren Kennel
                    const html = Results.buildEmptyKennelHtml(runError, kennelConfig);
                    res.setHeader('Content-Type', 'text/html; charset=utf-8');
                    res.send(html);
                } else {
                    // Andere Fehler normal behandeln
                    throw runError;
                }
            }
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
