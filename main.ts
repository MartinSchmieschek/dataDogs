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
import { GeocodingRetriever, GeocodingQueryPact, ElevationRetriever, ElevationQueryPact } from '@datadogs/dogs-geocoding';
import { WikiNearbyRetriever, WikiNearbyQueryPact } from '@datadogs/dogs-wikipedia';
import { SunRetriever, SunQueryPact } from '@datadogs/dogs-sun';
import { SpeciesRetriever, BiodiversityQueryPact } from '@datadogs/dogs-biodiversity';
import { BirdRetriever, BirdQueryPact } from '@datadogs/dogs-birds';
import { PhenologyRetriever, PhenologyQueryPact } from '@datadogs/dogs-phenology';
import { WebcamRetriever, WebcamQueryPact } from '@datadogs/dogs-webcams';
import { RegionalNewsRetriever, RegionalNewsQueryPact } from '@datadogs/dogs-regional-news';
import { TransitTripRetriever, TransitTripQueryPact } from '@datadogs/dogs-transit-trips';
import { TrailRetriever, TrailQueryPact } from '@datadogs/dogs-trails';
import { AstronomyRetriever, AstronomyQueryPact } from '@datadogs/dogs-astronomy';
import { WaterRetriever, WaterQueryPact } from '@datadogs/dogs-water';
import { HistoricalWeatherRetriever, HistoricalWeatherQueryPact } from '@datadogs/dogs-historical-weather';
import { ChargingStationRetriever, ChargingQueryPact } from '@datadogs/dogs-charging';
import { NoiseRetriever, NoiseQueryPact } from '@datadogs/dogs-noise';
import { ParkingRetriever, ParkingQueryPact } from '@datadogs/dogs-parking';
import { PlaygroundRetriever, PlaygroundQueryPact } from '@datadogs/dogs-playground';
import { DrinkingWaterRetriever, DrinkingWaterQueryPact } from '@datadogs/dogs-drinking-water';
import { OpenFoodRetriever, OpenFoodQueryPact } from '@datadogs/dogs-food';
import { CurrencyRetriever, CurrencyQueryPact } from '@datadogs/dogs-currency';
import { HolidayRetriever, HolidayQueryPact } from '@datadogs/dogs-holidays';
import { WikiSearchRetriever, WikiSearchQueryPact } from '@datadogs/dogs-wiki-search';
import { SeasonRetriever, SeasonQueryPact } from '@datadogs/dogs-season';
import { IPGeoRetriever, IPGeoQueryPact } from '@datadogs/dogs-ip-geo';
import { RandomFactRetriever, RandomFactQueryPact } from '@datadogs/dogs-random-fact';
import { SpaceRetriever, SpaceQueryPact } from '@datadogs/dogs-space';
import { OpenLibraryRetriever, OpenLibraryQueryPact } from '@datadogs/dogs-open-library';
import { GitHubTrendingRetriever, GitHubTrendingQueryPact } from '@datadogs/dogs-github-trending';
import { ISerializedDogConfig, SerializedDog, type ICacheHandler } from '@datadogs/core';
import { IStore } from './store/IStore';
import { PrismaStore } from './store/PrismaStore';
import express from "express";
import { Controller } from './api/Controller';
import { KennelController } from './api/KennelController';
import { ControllerRegistry, ConfigRouteHandler } from './api/routes/ConfigRouteHandler';
import { KennelRunHandler } from './api/routes/KennelRunHandler';
import { KennelSwaggerHandler } from './api/routes/KennelSwaggerHandler';
import { KennelBundleHandler } from './api/routes/KennelBundleHandler';
import { NodesRouteHandler } from './api/routes/NodesRouteHandler';
import { ReadmeRouteHandler } from './api/routes/ReadmeRouteHandler';
import { StartupTest } from './StartupTest';
import { runSeeds } from './seed-data/seed';
import { TypeDefBuilder } from './services/TypeDefBuilder';
import { SqliteCacheHandler } from './services/SqliteCacheHandler';

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
        SpeciesRetriever,
        BirdRetriever,
        PhenologyRetriever,
        WebcamRetriever,
        RegionalNewsRetriever,
        TransitTripRetriever,
        ElevationRetriever,
        TrailRetriever,
        AstronomyRetriever,
        WaterRetriever,
        HistoricalWeatherRetriever,
        ChargingStationRetriever,
        NoiseRetriever,
        ParkingRetriever,
        PlaygroundRetriever,
        DrinkingWaterRetriever,
        OpenFoodRetriever,
        CurrencyRetriever,
        HolidayRetriever,
        WikiSearchRetriever,
        SeasonRetriever,
        IPGeoRetriever,
        RandomFactRetriever,
        SpaceRetriever,
        OpenLibraryRetriever,
        GitHubTrendingRetriever,
    ];

    // Breathe life into each hound — those who lack their credentials perish in the constructor.
    // The survivors form the pack; the fallen are mourned in the logs.
    const allBaseDogs: InstanceType<typeof allBaseDogClasses[number]>[] = [];
    const baseDogsMap = new Map<string, new () => any>();

    for (const DogClass of allBaseDogClasses) {
        try {
            const instance = new DogClass();
            allBaseDogs.push(instance);
            baseDogsMap.set(instance.name, DogClass);
        } catch (err: any) {
            console.warn(`  ✗ ${DogClass.name} could not rise — ${err.message}`);
        }
    }

    // The Pacts — eldritch contracts sealed between dogs and the void,
    // through which the MimicDog may wear another's form.
    // Through endless faces, countless forms, a multitude unfolds.
    const allPacts = [LayoutInputPact, BloodhoundRouteQueryPact, BloodhoundIsochronePact, NearbyLandmarksPact, HueBridgeQueryPact, PublicTransportQueryPact, WeatherQueryPact, AirQualityQueryPact, GeocodingQueryPact, WikiNearbyQueryPact, SunQueryPact, BiodiversityQueryPact, BirdQueryPact, PhenologyQueryPact, WebcamQueryPact, RegionalNewsQueryPact, TransitTripQueryPact, ElevationQueryPact, TrailQueryPact, AstronomyQueryPact, WaterQueryPact, HistoricalWeatherQueryPact, ChargingQueryPact, NoiseQueryPact, ParkingQueryPact, PlaygroundQueryPact, DrinkingWaterQueryPact, OpenFoodQueryPact, CurrencyQueryPact, HolidayQueryPact, WikiSearchQueryPact, SeasonQueryPact, IPGeoQueryPact, RandomFactQueryPact, SpaceQueryPact, OpenLibraryQueryPact, GitHubTrendingQueryPact];
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

    // Summon the nodes manifest and the sacred scrolls — each handler a star in the eldritch sky.
    const nodesRouteHandler = new NodesRouteHandler(registry, allBaseDogs);
    nodesRouteHandler.registerRoutes(app);
    const readmeRouteHandler = new ReadmeRouteHandler(__dirname);
    readmeRouteHandler.registerRoutes(app);

    // Raise the CRUD sails — all routes for nodes and kennels now billow in the cosmic wind.
    const routeHandler = new ConfigRouteHandler(registry);
    routeHandler.registerRoutes(app, '/api');

    // The cache — memory across voyages, so no hound fetches what the hold already brims with.
    const cacheHandler: ICacheHandler = new SqliteCacheHandler(process.env.CACHE_DB_PATH || './cache.db');

    // Loose the kennel hounds upon the sea — run, execute, and public endpoints all set aflame.
    // Roiling, moaning, this realm of ours: the kennels run and data flows from the eldritch deep.
    const kennelRunHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, cacheHandler });
    const kennelSwaggerHandler = new KennelSwaggerHandler(kennelRunHandler);
    const kennelBundleHandler = new KennelBundleHandler(kennelRunHandler, kennelsController, nodesStore);
    kennelSwaggerHandler.registerRoutes(app);
    kennelBundleHandler.registerRoutes(app);
    kennelRunHandler.registerRoutes(app);

    console.log('App started.');
    app.listen(port, () => {
        console.log(`Server läuft auf http://localhost:${port}`);
    });
}
