import 'dotenv/config';

process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
});

import { QueryRetriever, BodyRetriever } from '@datadogs/core';
import {
    RandomRecipesRetriever,
    RandomEveryThingRetriever,
    CountryFlagBlackLab,
    DishFlagBlackLab,
} from '@datadogs/dogs-demo';
import { TalkingDog, LayoutInputPact } from '@datadogs/dogs-talking';
import { WarframeAlertsRetriever } from '@datadogs/dogs-warframe';
import {
    BloodhoundRouteRetriever,
    BloodhoundIsochroneRetriever,
    OsmLandmarksRetriever,
    BloodhoundRouteQueryPact,
    BloodhoundIsochronePact,
    NearbyLandmarksPact,
} from '@datadogs/dogs-geo';
import { HuePlaygroundRetriever, HueBridgeEnvRetriever, HueBridgeQueryPact } from '@datadogs/dogs-hue';
import { ISerializedDogConfig, SerializedDog, BASE_DOG_PREFIX } from '@datadogs/core';
import { IStore } from './store/IStore';
import { PrismaStore } from './store/PrismaStore';
import express from "express";
import { Controller } from './api/Controller';
import { KennelController } from './api/KennelController';
import { ControllerRegistry, ConfigRouteHandler } from './api/routes/ConfigRouteHandler';
import { KennelRunHandler } from './api/routes/KennelRunHandler';
import { StartupTest } from './StartupTest';
import { runSeeds } from './seed';
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
        OsmLandmarksRetriever,
        HueBridgeEnvRetriever,
        HuePlaygroundRetriever,
    ];

    const allBaseDogs = allBaseDogClasses.map(DogClass => new DogClass());

    const baseDogsMap = new Map<string, new () => any>();
    allBaseDogClasses.forEach(DogClass => {
        const instance = new DogClass();
        baseDogsMap.set(instance.name, DogClass);
    });

    const allPacts = [LayoutInputPact, BloodhoundRouteQueryPact, BloodhoundIsochronePact, NearbyLandmarksPact, HueBridgeQueryPact];
    allPacts.forEach(PactClass => {
        const instance = new PactClass();
        baseDogsMap.set(instance.name, PactClass);
    });
    TypeDefBuilder.registerPacts(allPacts);

    const app = express();
    const port = 3000;

    /**
     * Welche Browser-Origin darf die API cross-origin nutzen?
     * - CORS_ALLOWED_ORIGINS: Komma-getrennt (setzt sich durch Dev/Prod-Defaults durch).
     * - Production ohne Liste: CORS_ORIGIN oder DEV_UI_ORIGIN (ein Wert), nur exakt dieser Origin.
     * - Development ohne Liste: jede http(s)-Origin mit localhost oder 127.0.0.1 (beliebiger Port),
     *   z. B. zweite Angular-App die Daten konsumiert (nicht nur die Edit-UI mit Proxy).
     */
    const isLocalDevOrigin = (origin: string): boolean => {
        try {
            const u = new URL(origin);
            return (
                (u.protocol === 'http:' || u.protocol === 'https:') &&
                (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
            );
        } catch {
            return false;
        }
    };

    const allowedOriginForRequest = (req: any): string | undefined => {
        const origin = req.headers.origin as string | undefined;
        if (!origin) return undefined;

        const list = process.env.CORS_ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean);
        if (list?.length) {
            return list.includes(origin) ? origin : undefined;
        }

        if (process.env.NODE_ENV === 'production') {
            const fixed = process.env.CORS_ORIGIN ?? process.env.DEV_UI_ORIGIN ?? 'http://localhost:4300';
            return origin === fixed ? origin : undefined;
        }

        return isLocalDevOrigin(origin) ? origin : undefined;
    };

    app.use((req: any, res: any, next: any) => {
        const allow = allowedOriginForRequest(req);
        if (allow) {
            res.setHeader('Access-Control-Allow-Origin', allow);
            res.setHeader('Vary', 'Origin');
        }
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') {
            res.sendStatus(204);
            return;
        }
        next();
    });

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
                type: 'BaseDog',
                icon: dog.icon,
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
