// Ahoy, ye who peer into this abyss — 'tis the beating black heart of the ship.
// From brooding gulfs are we beheld by that which bears no name,
// yet we set sail regardless, for the data must be plundered.
import 'dotenv/config';

// Should the void swallow a promise whole and leave no trace, at least we shall log its dying scream.
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
import { PublicTransportRetriever, PublicTransportQueryPact } from '@datadogs/dogs-public-transport';
import { WeatherRetriever, WeatherQueryPact } from '@datadogs/dogs-weather';
import { AirQualityRetriever, AirQualityQueryPact } from '@datadogs/dogs-air-quality';
import { GeocodingRetriever, GeocodingQueryPact } from '@datadogs/dogs-geocoding';
import { WikiNearbyRetriever, WikiNearbyQueryPact } from '@datadogs/dogs-wikipedia';
import { SunRetriever, SunQueryPact } from '@datadogs/dogs-sun';
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

// Cast off the moorings — if our vessel fails to launch, we sink into the deep and trouble no man further.
start().catch(e => {
    console.error('Failed to start', e);
    process.exit(1);
});

async function start() {
    // Seek the DATABASE_URL from the env scroll; should it bear no name, sail to the local waters of dev.db.
    const dbUrl = process.env.DATABASE_URL ?? 'file:./dev.db';

    // Two stores, one for the hounds, one for their kennels — twin anchors in the eldritch deep.
    const nodesStore: IStore = new PrismaStore(dbUrl);
    const kennelsStore: IStore = new PrismaStore(dbUrl);

    // Rouse the stores from their slumber lest the connection rot in the bilge.
    if ((nodesStore as any).init) await (nodesStore as any).init();
    if ((kennelsStore as any).init) await (kennelsStore as any).init();

    // Plant the first bones in the earth — the seeds from which our pack shall grow.
    await runSeeds(nodesStore, kennelsStore);

    // Arr, the full crew of base hounds — each born of corporeal law, each ready to hunt.
    // To cosmic madness laws submit, though stalwart minds entreat.
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
        PublicTransportRetriever,
        WeatherRetriever,
        AirQualityRetriever,
        GeocodingRetriever,
        WikiNearbyRetriever,
        SunRetriever,
    ];

    // Breathe life into each hound — from tangent planes they rise, ready to hunt the data seas.
    const allBaseDogs = allBaseDogClasses.map(DogClass => new DogClass());

    // Chart the hounds by name upon our map — a roster of those who shall answer the call.
    const baseDogsMap = new Map<string, new () => any>();
    allBaseDogClasses.forEach(DogClass => {
        const instance = new DogClass();
        baseDogsMap.set(instance.name, DogClass);
    });

    // The Pacts — eldritch contracts sealed between dogs and the void,
    // through which the MimicDog may wear another's form.
    // Through endless faces, countless forms, a multitude unfolds.
    const allPacts = [LayoutInputPact, BloodhoundRouteQueryPact, BloodhoundIsochronePact, NearbyLandmarksPact, HueBridgeQueryPact, PublicTransportQueryPact, WeatherQueryPact, AirQualityQueryPact, GeocodingQueryPact, WikiNearbyQueryPact, SunQueryPact];
    allPacts.forEach(PactClass => {
        const instance = new PactClass();
        baseDogsMap.set(instance.name, PactClass);
    });
    TypeDefBuilder.registerPacts(allPacts);

    const app = express();
    const port = 3000;

    /**
     * Which vessels may approach our ship cross-origin without being blown out of the water?
     * - CORS_ALLOWED_ORIGINS: A comma-split list of allowed origins — those who may seek our plunder.
     * - In production without a list: only the single origin named in CORS_ORIGIN or DEV_UI_ORIGIN shall pass.
     * - In development without a list: any localhost vessel on any port may dock freely,
     *   for in luminous dev space we gaze upon all, accuse none, deny few.
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

    // Assemble the registry — a chart of all controllers that sail under our black flag.
    const registry = new ControllerRegistry();
    const nodesController = new Controller<ISerializedDogConfig>(nodesStore, SerializedDog.name);
    const kennelsController = new KennelController(kennelsStore);
    registry.register('nodes', nodesController);
    registry.register('kennels', kennelsController);

    // Run the startup trials — our pack must prove itself before the hunt may begin.
    // Carrion hordes trill their profane accord: if the tests fail, chaos reigns.
    const startupTest = new StartupTest();
    await startupTest.runAllTests(nodesStore, kennelsStore, nodesController, kennelsController, baseDogsMap);

    // GET /api/nodes — summons the manifest of hounds.
    // If ?kennelId=xxx is given, only dogs that crew that kennel are returned.
    // Without kennelId, all base dogs and all serialized dogs are returned.
    app.get('/api/nodes', async (req: any, res: any) => {
        try {
            const controller = registry.get('nodes');
            if (!controller) { res.status(404).json({ error: 'Node-Controller nicht gefunden' }); return; }

            const kennelId = req.query.kennelId as string | undefined;

            // Only list SerializedDogs — MimicDogs are pact-bound and never appear in the toolbar.
            // listLatest() queries by entityType 'SerializedDog', so MimicDogs (type 'MimicDog') are excluded.
            const result = await controller.listLatest();
            let serializedDogs = result.ok && result.data ? result.data : [];
            const baseDogsList = allBaseDogs.map(dog => ({
                id: BASE_DOG_PREFIX + dog.name,
                name: dog.name,
                type: 'BaseDog',
                icon: dog.icon,
            }));

            // If a kennel is specified, filter to only dogs that are in that kennel's dogIds.
            if (kennelId) {
                const kennelController = registry.get('kennels');
                const kennelResult = kennelController ? await kennelController.getById(kennelId) : null;
                const kennelDogIds: string[] = (kennelResult?.data as any)?.dogIds ?? [];

                if (kennelDogIds.length > 0) {
                    // Build a set of all identifiers the kennel uses — both the raw entries
                    // AND the resolved dogIds (lineage GUIDs) for pinned version references.
                    const kennelSet = new Set<string>(kennelDogIds);
                    for (const kid of kennelDogIds) {
                        if (kid.startsWith(BASE_DOG_PREFIX)) continue;
                        // If this entry is a version-ID (pinned), resolve its lineageId too.
                        const match = serializedDogs.find((d: any) => d.id === kid);
                        if (match && (match as any).lineageId) {
                            kennelSet.add((match as any).lineageId);
                        }
                    }

                    // Exclude dogs already in the kennel — the toolbar shows what can be ADDED.
                    serializedDogs = serializedDogs.filter((d: any) =>
                        !kennelSet.has(d.id) && !kennelSet.has(d.lineageId)
                    );
                    const filteredBase = baseDogsList.filter(d => !kennelSet.has(d.id));
                    res.status(200).json({ ok: true, data: [...filteredBase, ...serializedDogs] });
                    return;
                }
            }

            res.status(200).json({ ok: true, data: [...baseDogsList, ...serializedDogs] });
        } catch (e) {
            console.error('[/api/nodes]', e);
            res.status(500).json({ error: String(e) });
        }
    });

    // Raise the CRUD sails — all routes for nodes and kennels now billow in the cosmic wind.
    const routeHandler = new ConfigRouteHandler(registry);
    routeHandler.registerRoutes(app, '/api');

    // Loose the kennel hounds upon the sea — run, execute, and public endpoints all set aflame.
    // Roiling, moaning, this realm of ours: the kennels run and data flows from the eldritch deep.
    const kennelRunHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap });
    kennelRunHandler.registerRoutes(app);

    console.log('App started.');
    app.listen(port, () => {
        console.log(`Server läuft auf http://localhost:${port}`);
    });
}
