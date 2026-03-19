import { DishFlagBlackLab } from './dogs/DishFlagBlackLab';
import { RandomRecipesRetriever } from "./dogs/RandomRecipesRetriever";
import { CountryFlagBlackLab } from "./dogs/CountryFlagBlackLab";
import { RandomEveryThingRetriever } from './dogs/RandomEverthingRetriever';
import { QueryRetriever } from './dogs/QueryRetriever';
import { BodyRetriever } from './dogs/BodyRetriever';
import { IStore } from './store/IStore';
import { PrismaStore } from './store/PrismaStore';
import express from "express";
import { TalkingDog } from './dogs/TalkingDogs/TalkingDog';
import { WarframeAlertsRetriever } from './dogs/Kubrow/WarframeAlertsRetriever';
import { BloodhoundRouteRetriever } from './dogs/Bloodhound/BloodhoundRouteRetriever';
import { BloodhoundIsochroneRetriever } from './dogs/Bloodhound/BloodhoundIsochroneRetriever';
import { ISerializedDogConfig, SerializedDog, BASE_DOG_PREFIX } from 'datadogs';
import { Controller } from './api/Controller';
import { KennelController } from './api/KennelController';
import { ControllerRegistry, ConfigRouteHandler } from './api/routes/ConfigRouteHandler';
import { KennelRunHandler } from './api/routes/KennelRunHandler';
import { StartupTest } from './StartupTest';
import { runSeeds } from './seed';
import { LayoutInputPact } from './dogs/TalkingDogs/renderer/layouts/ILayoutInput';
import { BloodhoundRouteQueryPact, BloodhoundIsochronePact } from './dogs/Bloodhound/pacts';
import { TypeDefBuilder } from './services/TypeDefBuilder';

start().catch(e => {
    console.error('Failed to start', e);
    process.exit(1);
});

async function start() {
    const dbUrl = process.env.DATABASE_URL ?? 'file:./dev.db';

    const nodesStore: IStore = new PrismaStore(dbUrl);
    const kennelsStore: IStore = new PrismaStore(dbUrl);

    if ((nodesStore as any).init) await (nodesStore as any).init();
    if ((kennelsStore as any).init) await (kennelsStore as any).init();

    await runSeeds(nodesStore, kennelsStore);

    const allBaseDogClasses = [
        TalkingDog,
        RandomRecipesRetriever,
        CountryFlagBlackLab,
        DishFlagBlackLab,
        RandomEveryThingRetriever,
        QueryRetriever,
        BodyRetriever,
        WarframeAlertsRetriever,
        BloodhoundRouteRetriever,
        BloodhoundIsochroneRetriever,
    ];

    const allBaseDogs = allBaseDogClasses.map(DogClass => new DogClass());

    const baseDogsMap = new Map<string, new () => any>();
    allBaseDogClasses.forEach(DogClass => {
        const instance = new DogClass();
        baseDogsMap.set(instance.name, DogClass);
    });

    const allPacts = [LayoutInputPact, BloodhoundRouteQueryPact, BloodhoundIsochronePact];
    allPacts.forEach(PactClass => {
        const instance = new PactClass();
        baseDogsMap.set(instance.name, PactClass);
    });
    TypeDefBuilder.registerPacts(allPacts);

    const app = express();
    const port = 3000;
    app.use(express.json());

    // Controller-Registry
    const registry = new ControllerRegistry();
    const nodesController = new Controller<ISerializedDogConfig>(nodesStore, SerializedDog.name);
    const kennelsController = new KennelController(kennelsStore);
    registry.register('nodes', nodesController);
    registry.register('kennels', kennelsController);

    // Startup-Tests
    const startupTest = new StartupTest();
    await startupTest.runAllTests(nodesStore, kennelsStore, nodesController, kennelsController, baseDogsMap);

    // GET /api/nodes — kombiniert BaseDogs + SerializedDogs
    app.get('/api/nodes', async (req: any, res: any) => {
        try {
            const controller = registry.get('nodes');
            if (!controller) { res.status(404).json({ error: 'Node-Controller nicht gefunden' }); return; }

            const result = await controller.list();
            const serializedDogs = result.ok && result.data ? result.data : [];
            const baseDogsList = allBaseDogs.map(dog => ({
                id: BASE_DOG_PREFIX + dog.name,
                name: dog.name,
                type: 'BaseDog'
            }));

            res.status(200).json({ ok: true, data: [...baseDogsList, ...serializedDogs] });
        } catch (e) {
            console.error('[/api/nodes]', e);
            res.status(500).json({ error: String(e) });
        }
    });

    // Generisches CRUD Route-System
    const routeHandler = new ConfigRouteHandler(registry);
    routeHandler.registerRoutes(app, '/api');

    // Kennel-Run Routen (run, execute, /:kennelId)
    const kennelRunHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap });
    kennelRunHandler.registerRoutes(app);

    console.log('App started.');
    app.listen(port, () => {
        console.log(`Server läuft auf http://localhost:${port}`);
    });
}
