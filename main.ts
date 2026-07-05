// Ahoy, ye who peer into this abyss — 'tis the beating black heart of the ship.
// From brooding gulfs are we beheld by that which bears no name,
// yet we set sail regardless, for the data must be plundered.
// Env: `node -r ./scripts/load-env.cjs …` (see package.json: start / start:prod / dev).

// Should the void swallow a promise whole and leave no trace, at least we shall log its dying scream.
process.on('unhandledRejection', (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    console.error('[unhandledRejection]', msg);
});

import { QueryRetriever, BodyRetriever } from '@datadogs/core';
import {
    RandomRecipesRetriever,
    RandomEveryThingRetriever,
    CountryFlagBlackLab,
    DishFlagBlackLab,
    FoodPornRetriever,
} from '@datadogs/dogs-demo';
import { TalkingDog, LayoutInputPact } from '@datadogs/dogs-talking';
import { WarframeAlertsRetriever } from '@datadogs/dogs-warframe';
import {
    BloodhoundRouteRetriever,
    BloodhoundIsochroneRetriever,
    OsmLandmarksRetriever,
    OsmTracksRetriever,
    OsmVegetationRetriever,
    OsmFastRoadsRetriever,
    OsmBuildingsRetriever,
    OsmRailsRetriever,
    OsmLandscapeFeaturesRetriever,
    OsmWaterRetriever,
    OsmLanduseRetriever,
    OsmAmenitiesRetriever,
    OsmBoundariesRetriever,
    OsmPowerRetriever,
    OsmPublicTransitStopsRetriever,
    OsmShopsRetriever,
    OsmSportsRecreationRetriever,
    BloodhoundRouteQueryPact,
    BloodhoundIsochronePact,
    NearbyLandmarksPact,
    NearbyTracksPact,
    NearbyVegetationPact,
    NearbyFastRoadsPact,
    OsmBuildingsGeometryPact,
    OsmRailsGeometryPact,
    OsmLandscapeFeaturesPact,
    OsmWaterPact,
    OsmLandusePact,
    OsmAmenitiesPact,
    OsmBoundariesPact,
    OsmPowerPact,
    OsmPublicTransitStopsPact,
    OsmShopsPact,
    OsmSportsRecreationPact,
    DrinkingWaterRetriever,
    DrinkingWaterQueryPact,
    OpenFoodRetriever,
    OpenFoodQueryPact,
    NoiseRetriever,
    NoiseQueryPact,
    PlaygroundRetriever,
    PlaygroundQueryPact,
    ParkingRetriever,
    ParkingQueryPact,
    TrailRetriever,
    TrailQueryPact,
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
import { AstronomyRetriever, AstronomyQueryPact } from '@datadogs/dogs-astronomy';
import { WaterRetriever, WaterQueryPact } from '@datadogs/dogs-water';
import { HistoricalWeatherRetriever, HistoricalWeatherQueryPact } from '@datadogs/dogs-historical-weather';
import { ChargingStationRetriever, ChargingQueryPact } from '@datadogs/dogs-charging';
import { CurrencyRetriever, CurrencyQueryPact } from '@datadogs/dogs-currency';
import { HolidayRetriever, HolidayQueryPact } from '@datadogs/dogs-holidays';
import { WikiSearchRetriever, WikiSearchQueryPact } from '@datadogs/dogs-wiki-search';
import { SeasonRetriever, SeasonQueryPact } from '@datadogs/dogs-season';
import { IPGeoRetriever, IPGeoQueryPact } from '@datadogs/dogs-ip-geo';
import { RandomFactRetriever, RandomFactQueryPact } from '@datadogs/dogs-random-fact';
import { SpaceRetriever, SpaceQueryPact } from '@datadogs/dogs-space';
import { OpenLibraryRetriever, OpenLibraryQueryPact } from '@datadogs/dogs-open-library';
import { GitHubTrendingRetriever, GitHubTrendingQueryPact } from '@datadogs/dogs-github-trending';
import { GeoPointPact } from '@datadogs/geo-pact';
import {
    JokeRetriever, JokeQueryPact,
    DadJokeRetriever, DadJokeQueryPact,
    ChuckNorrisRetriever, ChuckNorrisQueryPact,
} from '@datadogs/dogs-humor';
import {
    CatFactRetriever, CatFactQueryPact,
    FoxRetriever, FoxQueryPact,
    DuckRetriever, DuckQueryPact,
} from '@datadogs/dogs-animals-random';
import {
    DictionaryRetriever,
    DatamuseRetriever, DatamuseQueryPact,
    WordQueryPact,
} from '@datadogs/dogs-dictionary';
import {
    QuoteRetriever, QuoteQueryPact,
    GutenbergRetriever, GutenbergQueryPact,
    WikidataRetriever, WikidataQueryPact,
} from '@datadogs/dogs-knowledge';
import {
    StarWarsRetriever, RickMortyRetriever, HarryPotterRetriever, GhibliRetriever,
    PopCultureQueryPact,
} from '@datadogs/dogs-pop-culture';
import {
    MusicBrainzRetriever, MusicBrainzQueryPact,
    LyricsRetriever, LyricsQueryPact,
    RadioBrowserRetriever, RadioBrowserQueryPact,
} from '@datadogs/dogs-music';
import {
    F1Retriever, F1QueryPact,
    SportsDBRetriever, SportsDbQueryPact,
    ChessRetriever, ChessQueryPact,
} from '@datadogs/dogs-sports';
import {
    NpmRetriever, NpmQueryPact,
    StackExchangeRetriever, StackExchangeQueryPact,
    GitHubPublicRetriever, GitHubPublicQueryPact,
} from '@datadogs/dogs-dev';
import {
    AirportRetriever, AirportQueryPact,
    GeoNamesRetriever,
    WikivoyageRetriever, WikivoyageQueryPact,
} from '@datadogs/dogs-travel';
import {
    TriviaRetriever, TriviaQueryPact,
    BoredRetriever, BoredQueryPact,
    RandomUserRetriever, RandomUserQueryPact,
} from '@datadogs/dogs-quiz';
import {
    BibleRetriever, BibleQueryPact,
    QuranRetriever, QuranQueryPact,
} from '@datadogs/dogs-religion';
import {
    DiseaseRetriever, DiseaseQueryPact,
    OpenFdaRetriever, OpenFdaQueryPact,
} from '@datadogs/dogs-health';
import {
    CocktailRetriever, CocktailQueryPact,
    MealRetriever, MealQueryPact,
} from '@datadogs/dogs-cuisine';
import {
    WaybackRetriever, WaybackQueryPact,
} from '@datadogs/dogs-web-archive';
import {
    DogCeoRetriever, DogCeoQueryPact,
    PicsumRetriever, PicsumQueryPact,
    NasaApodRetriever, NasaApodQueryPact,
} from '@datadogs/dogs-images';
import {
    AgifyRetriever,
    NationalizeRetriever,
    GenderizeRetriever,
    NameQueryPact,
} from '@datadogs/dogs-name-insights';
import {
    PokeApiRetriever, PokeApiQueryPact,
    DeckOfCardsRetriever, DeckOfCardsQueryPact,
    ScryfallRetriever, ScryfallQueryPact,
} from '@datadogs/dogs-gaming';
import {
    LibreTranslateRetriever, LibreTranslateQueryPact,
} from '@datadogs/dogs-translate';
import {
    TvMazeRetriever, TvMazeQueryPact,
} from '@datadogs/dogs-tv';
import {
    HackerNewsRetriever, HackerNewsQueryPact,
    LemmyRetriever, LemmyQueryPact,
} from '@datadogs/dogs-social';
import {
    CoinGeckoRetriever, CoinGeckoQueryPact,
} from '@datadogs/dogs-crypto';
import {
    ISerializedDogConfig,
    SerializedDog,
    type ICacheHandler,
    WebSocketChannelRetriever,
    ChannelLiveSnippetRetriever,
    registerVmGlobalCapability,
} from '@datadogs/core';
import http from 'http';
import { ChannelHub } from './services/ChannelHub';
import { IStore } from './store/IStore';
import { PrismaStore } from './store/PrismaStore';
import { JsonStorageService } from './services/JsonStorageService';
import express from "express";
import path from 'path';
import fs from 'fs';
import { Controller } from './api/Controller';
import { KennelController } from './api/KennelController';
import { ControllerRegistry, ConfigRouteHandler } from './api/routes/ConfigRouteHandler';
import { KennelRunHandler } from './api/routes/KennelRunHandler';
import { KennelSwaggerHandler } from './api/routes/KennelSwaggerHandler';
import { KennelBundleHandler } from './api/routes/KennelBundleHandler';
import { NodesRouteHandler } from './api/routes/NodesRouteHandler';
import { ReadmeRouteHandler } from './api/routes/ReadmeRouteHandler';
import { SPA_FALLBACK_SKIP_PREFIXES } from './api/routes/spaRouteConstants';
import cookieParser from 'cookie-parser';
import { PrismaClient as AuthPrismaClient } from './store/generated/prisma-auth-client';
import { createSessionMiddleware } from './mcp/auth/sessions';
import { createAuthRouter } from './mcp/auth/router';
import { createAuthContextMiddleware } from './mcp/auth/middleware';
import { createDiscoveryRouter } from './mcp/auth/discovery';
import { createMcpRouter } from './mcp/transports/mcp';
import { createActionsRouter } from './mcp/transports/openapi';
import { KennelSnapshotCache } from './mcp/snapshots/KennelSnapshotCache';
import { StartupTest } from './StartupTest';
import { runSeeds } from './seed-data/seed';
import { TypeDefBuilder } from './services/TypeDefBuilder';
import { CompilerCache } from './services/CompilerCache';
import { PrismaCacheHandler } from './services/PrismaCacheHandler';
import { withResilientCacheInfra } from './services/resilientCacheHandler';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dbEnv = require(path.join(process.cwd(), 'scripts', 'dbEnv.cjs')) as {
    assertRequiredDbEnv: () => void;
    resolveCacheDatabaseUrl: () => string;
    resolveJsonStorageDatabaseUrl: () => string;
};

/** Angular-Produktionsbuild (Application-Builder → …/browser), nur wenn index.html existiert. */
function resolveAngularBrowserDir(): string | null {
    const candidates = [
        path.join(__dirname, '..', 'ui-app', 'dist', 'ui-app', 'browser'),
        path.join(__dirname, 'ui-app', 'dist', 'ui-app', 'browser'),
    ];
    for (const dir of candidates) {
        if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
    }
    return null;
}

/** `public/` für `/static/*` (Swagger-Info-Hintergrundbild, …). Bei `dist/main.js` liegt `__dirname` unter `dist/`. */
function resolvePublicDir(): string | null {
    const candidates = [path.join(__dirname, 'public'), path.join(__dirname, '..', 'public')];
    for (const dir of candidates) {
        if (fs.existsSync(dir)) return dir;
    }
    return null;
}

// Cast off the moorings — if our vessel fails to launch, we sink into the deep and trouble no man further.
start().catch(e => {
    console.error('Failed to start', e);
    process.exit(1);
});

async function start() {
    dbEnv.assertRequiredDbEnv();
    const dbUrl = process.env.DATABASE_URL!.trim();

    // Two stores, one for the hounds, one for their kennels — twin anchors in the eldritch deep.
    const nodesStore: IStore = new PrismaStore(dbUrl);
    const kennelsStore: IStore = new PrismaStore(dbUrl);

    // Rouse the stores from their slumber lest the connection rot in the bilge.
    if ((nodesStore as any).init) await (nodesStore as any).init();
    if ((kennelsStore as any).init) await (kennelsStore as any).init();

    // Plant the first bones in the earth — the seeds from which our pack shall grow.
    await runSeeds(nodesStore, kennelsStore);

    // Fachliche JSON-Ablage: eigene SQLite (JSON_STORAGE_DATABASE_URL), bewusst getrennt
    // von Nodes/Kennels (DATABASE_URL) und Run-Cache (CACHE_DATABASE_URL).
    //
    // Welle 7: jsonStore ist VM-Infrastruktur, kein Daten-Pakt. Statt einen BaseDog
    // (JsonStorageRetriever) zu registrieren, legen wir die Bruecke direkt als VM-Global-
    // Capability beim Core ab. Jeder SerializedDog sieht `jsonStore` damit automatisch im
    // VM-Context, ohne einen Parent zu deklarieren -- so wie er auch `fetch` und `console`
    // sieht.
    const jsonStorageService = new JsonStorageService(dbEnv.resolveJsonStorageDatabaseUrl());
    registerVmGlobalCapability('jsonStore', (ctx) => {
        // Welle 8: Tenant-Scoping.
        //
        //   - Super-User (dev mode, MCP_AUTH_REQUIRED=false) -> raw keys
        //     (Backwards-Compat fuer Tests + administrative Inspektion).
        //   - Anonymer Aufruf (kein eingeloggter User, kein super-user) -> raw keys
        //     (oeffentliche Kennels nutzen einen geteilten Namespace -- noch nicht
        //     pro-anonymous-session getrennt; das waere Welle 9).
        //   - Eingeloggter User -> Keys werden mit `user:<userId>:` prefixiert,
        //     `list()` filtert + strippt das Prefix transparent.
        const userId = ctx?.userId ?? null;
        const isSuper = ctx?.isSuperUser === true;
        const usePrefix = !isSuper && typeof userId === 'string' && userId.length > 0;
        const prefix = usePrefix ? `user:${userId}:` : '';
        const wrap = (k: string) => prefix + k;

        return {
            get: (k: string) => jsonStorageService.get(wrap(k)),
            set: (k: string, v: unknown) => jsonStorageService.set(wrap(k), v),
            delete: (k: string) => jsonStorageService.delete(wrap(k)),
            has: (k: string) => jsonStorageService.has(wrap(k)),
            list: async () => {
                const all = await jsonStorageService.list();
                if (!usePrefix) return all;
                return all
                    .filter((k) => k.startsWith(prefix))
                    .map((k) => k.substring(prefix.length));
            },
            snapshot: async () => {
                const all = await jsonStorageService.snapshot();
                if (!usePrefix) return all;
                return all
                    .filter((e) => e.key.startsWith(prefix))
                    .map((e) => ({ ...e, key: e.key.substring(prefix.length) }));
            },
        };
    });

    // Lobby-Hub: In-Memory-Raeume fuer den WebSocketChannelRetriever.
    const channelHub = new ChannelHub({
        heartbeatSec: Number(process.env.WS_HEARTBEAT_SEC) || undefined,
        emptyTtlSec: Number(process.env.WS_EMPTY_TTL_SEC) || undefined,
        maxMessageBytes: Number(process.env.WS_MAX_MESSAGE_BYTES) || undefined,
        maxPeersPerChannel: Number(process.env.WS_MAX_PEERS_PER_CHANNEL) || undefined,
        path: process.env.WS_PATH || undefined,
    });
    WebSocketChannelRetriever.initService(channelHub);

    // Arr, the full crew of base hounds — each born of corporeal law, each ready to hunt.
    // To cosmic madness laws submit, though stalwart minds entreat.
    const allBaseDogClasses = [
        TalkingDog,
        RandomRecipesRetriever,
        CountryFlagBlackLab,
        DishFlagBlackLab,
        RandomEveryThingRetriever,
        FoodPornRetriever,
        QueryRetriever,
        BodyRetriever,
        WarframeAlertsRetriever,
        BloodhoundRouteRetriever,
        BloodhoundIsochroneRetriever,
        OsmLandmarksRetriever,
        OsmTracksRetriever,
        OsmVegetationRetriever,
        OsmFastRoadsRetriever,
        OsmBuildingsRetriever,
        OsmRailsRetriever,
        OsmLandscapeFeaturesRetriever,
        OsmWaterRetriever,
        OsmLanduseRetriever,
        OsmAmenitiesRetriever,
        OsmBoundariesRetriever,
        OsmPowerRetriever,
        OsmPublicTransitStopsRetriever,
        OsmShopsRetriever,
        OsmSportsRecreationRetriever,
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
        // Welle 7: JsonStorageRetriever entfaellt als BaseDog -- `jsonStore` ist jetzt eine
        // VM-Global-Capability (siehe `registerVmGlobalCapability('jsonStore', ...)` oben)
        // und damit fuer jeden SerializedDog automatisch verfuegbar.
        WebSocketChannelRetriever,
        ChannelLiveSnippetRetriever,
        JokeRetriever,
        DadJokeRetriever,
        ChuckNorrisRetriever,
        CatFactRetriever,
        FoxRetriever,
        DuckRetriever,
        DictionaryRetriever,
        DatamuseRetriever,
        QuoteRetriever,
        GutenbergRetriever,
        WikidataRetriever,
        StarWarsRetriever,
        RickMortyRetriever,
        HarryPotterRetriever,
        GhibliRetriever,
        MusicBrainzRetriever,
        LyricsRetriever,
        RadioBrowserRetriever,
        F1Retriever,
        SportsDBRetriever,
        ChessRetriever,
        NpmRetriever,
        StackExchangeRetriever,
        GitHubPublicRetriever,
        AirportRetriever,
        GeoNamesRetriever,
        WikivoyageRetriever,
        TriviaRetriever,
        BoredRetriever,
        RandomUserRetriever,
        BibleRetriever,
        QuranRetriever,
        DiseaseRetriever,
        OpenFdaRetriever,
        CocktailRetriever,
        MealRetriever,
        WaybackRetriever,
        DogCeoRetriever,
        PicsumRetriever,
        NasaApodRetriever,
        AgifyRetriever,
        NationalizeRetriever,
        GenderizeRetriever,
        PokeApiRetriever,
        DeckOfCardsRetriever,
        ScryfallRetriever,
        LibreTranslateRetriever,
        TvMazeRetriever,
        HackerNewsRetriever,
        LemmyRetriever,
        CoinGeckoRetriever,
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
    const allPacts = [LayoutInputPact, BloodhoundRouteQueryPact, BloodhoundIsochronePact, NearbyLandmarksPact, NearbyTracksPact, NearbyVegetationPact, NearbyFastRoadsPact, OsmBuildingsGeometryPact, OsmRailsGeometryPact, OsmLandscapeFeaturesPact, OsmWaterPact, OsmLandusePact, OsmAmenitiesPact, OsmBoundariesPact, OsmPowerPact, OsmPublicTransitStopsPact, OsmShopsPact, OsmSportsRecreationPact, HueBridgeQueryPact, PublicTransportQueryPact, WeatherQueryPact, AirQualityQueryPact, GeocodingQueryPact, WikiNearbyQueryPact, SunQueryPact, BiodiversityQueryPact, BirdQueryPact, PhenologyQueryPact, WebcamQueryPact, RegionalNewsQueryPact, TransitTripQueryPact, ElevationQueryPact, TrailQueryPact, AstronomyQueryPact, WaterQueryPact, HistoricalWeatherQueryPact, ChargingQueryPact, NoiseQueryPact, ParkingQueryPact, PlaygroundQueryPact, DrinkingWaterQueryPact, OpenFoodQueryPact, CurrencyQueryPact, HolidayQueryPact, WikiSearchQueryPact, SeasonQueryPact, IPGeoQueryPact, RandomFactQueryPact, SpaceQueryPact, OpenLibraryQueryPact, GitHubTrendingQueryPact, GeoPointPact, JokeQueryPact, DadJokeQueryPact, ChuckNorrisQueryPact, CatFactQueryPact, FoxQueryPact, DuckQueryPact, WordQueryPact, DatamuseQueryPact, QuoteQueryPact, GutenbergQueryPact, WikidataQueryPact, PopCultureQueryPact, MusicBrainzQueryPact, LyricsQueryPact, RadioBrowserQueryPact, F1QueryPact, SportsDbQueryPact, ChessQueryPact, NpmQueryPact, StackExchangeQueryPact, GitHubPublicQueryPact, AirportQueryPact, WikivoyageQueryPact, TriviaQueryPact, BoredQueryPact, RandomUserQueryPact, BibleQueryPact, QuranQueryPact, DiseaseQueryPact, OpenFdaQueryPact, CocktailQueryPact, MealQueryPact, WaybackQueryPact, DogCeoQueryPact, PicsumQueryPact, NasaApodQueryPact, NameQueryPact, PokeApiQueryPact, DeckOfCardsQueryPact, ScryfallQueryPact, LibreTranslateQueryPact, TvMazeQueryPact, HackerNewsQueryPact, LemmyQueryPact, CoinGeckoQueryPact];
    allPacts.forEach(PactClass => {
        const instance = new PactClass();
        baseDogsMap.set(instance.name, PactClass);
    });
    // In production/integration: vorbereitete Type-Definitions laden, damit kein
    // ts.createProgram zur Laufzeit aufgerufen wird (Heap-Schonung auf kleinen Umgebungen).
    const envForTypeDefs = process.env.NODE_ENV;
    if (envForTypeDefs === 'production' || envForTypeDefs === 'integration') {
        const typeDefsPath = path.resolve(process.cwd(), 'dist', 'type-defs.json');
        if (fs.existsSync(typeDefsPath)) {
            try {
                const payload = JSON.parse(fs.readFileSync(typeDefsPath, 'utf-8'));
                CompilerCache.loadPrecomputed(payload);
                console.log(`[CompilerCache] Loaded precomputed type-defs from ${typeDefsPath}`);
            } catch (e) {
                console.error('[CompilerCache] Failed to load precomputed type-defs:', e);
            }
        } else {
            console.warn(`[CompilerCache] ${typeDefsPath} not found — falling back to live TS compilation (heap-heavy).`);
        }
    }

    TypeDefBuilder.registerPacts(allPacts);

    const app = express();
    const port = Number(process.env.PORT) || 3000;
    const nodeEnv = process.env.NODE_ENV || 'development';
    /** Gebautes Angular unter ui-app/dist/... ausliefern (nicht ng serve). Gilt für production und integration. */
    const serveBuiltAngular = nodeEnv === 'production' || nodeEnv === 'integration';
    const devUiOrigin = (process.env.DEV_UI_ORIGIN || 'http://localhost:4300').replace(/\/$/, '');

    /**
     * Which vessels may approach our ship cross-origin without being blown out of the water?
     * - CORS_ALLOWED_ORIGINS: comma-separated list — those who may seek our plunder.
     * - integration / production: CORS_ORIGIN oder DEV_UI_ORIGIN gesetzt → nur diese eine Origin;
     *   sonst Origin erlauben, wenn sie zum Request-Host passt (SPA + API unter derselben URL, z. B. Render).
     * - development ohne Liste: localhost-Origins.
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

    /** Origin-Header passt zur öffentlichen URL dieses Requests (x-forwarded-host / Host). */
    const originMatchesRequestHost = (req: any, origin: string): boolean => {
        try {
            const hostHeader = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
            if (!hostHeader) return false;
            return new URL(origin).host.toLowerCase() === hostHeader.toLowerCase();
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

        if (nodeEnv === 'production' || nodeEnv === 'integration') {
            const fixedRaw = process.env.CORS_ORIGIN ?? process.env.DEV_UI_ORIGIN;
            if (fixedRaw?.trim()) {
                const fixed = fixedRaw.replace(/\/$/, '');
                return origin === fixed ? origin : undefined;
            }
            return originMatchesRequestHost(req, origin) ? origin : undefined;
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

    app.use(express.json({ limit: '5mb' }));

    // === Auth pipeline (mcp/auth/*) — cookie-session + Google login + /auth/* router ===
    // Mounted before the SPA fallback so /auth/* is handled here, not by Angular.
    // The auth-context middleware runs on EVERY request: it attaches req.ctx with the
    // current user (or super-user when MCP_AUTH_REQUIRED=false) so downstream route
    // handlers can apply visibility/ownership filters.
    // Auth-specific Prisma client — uses AUTH_DATABASE_URL, separate from content DB.
    const authPrisma = new AuthPrismaClient();
    app.use(cookieParser());
    // OAuth POST endpoints accept application/x-www-form-urlencoded as well as JSON.
    app.use(express.urlencoded({ extended: false, limit: '1mb' }));
    app.use(createSessionMiddleware());
    app.use(createAuthContextMiddleware(authPrisma));
    app.use('/auth', createAuthRouter(authPrisma));
    app.use('/.well-known', createDiscoveryRouter());

    // Static assets (Swagger UI hero, etc.) — served from /static/*
    const publicDir = resolvePublicDir();
    if (publicDir) {
        app.use('/static', express.static(publicDir));
    }

    const angularBrowserDir = serveBuiltAngular ? resolveAngularBrowserDir() : null;
    if (angularBrowserDir) {
        app.use(express.static(angularBrowserDir, { index: 'index.html' }));
    }

    // Nur development: Root → ng serve (:4300). integration/production liefern die gebaute SPA von diesem Port.
    if (!serveBuiltAngular) {
        app.get('/', (_req, res) => {
            res.redirect(302, `${devUiOrigin}/`);
        });
    }

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
    // kennelsStore is passed so node-mutation routes can apply the kennel-owner-bypass rule.
    const routeHandler = new ConfigRouteHandler(registry, kennelsStore);
    routeHandler.registerRoutes(app, '/api');

    // The cache — eigenes SQLite via Prisma (store/prisma-cache), nicht der Node-Store.
    // Zielbild: schnelle, dedizierte Cache-Anbindung (z. B. Postgres laut CACHE_DATABASE_URL in
    // Prod) — Betreiber sollten Cache-Hits/Latenz im Blick haben. Bewusst noch nicht Priorität:
    // lokal reicht withResilientCacheInfra, damit SQLite-Lock/Timeout die Kennel-Runs nicht killt.
    const cacheHandler: ICacheHandler = withResilientCacheInfra(
        new PrismaCacheHandler(dbEnv.resolveCacheDatabaseUrl()),
    );

    // Loose the kennel hounds upon the sea — run, execute, and public endpoints all set aflame.
    // Roiling, moaning, this realm of ours: the kennels run and data flows from the eldritch deep.
    const kennelRunHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, cacheHandler });
    const kennelSwaggerHandler = new KennelSwaggerHandler(kennelRunHandler);
    const kennelBundleHandler = new KennelBundleHandler(kennelRunHandler, kennelsController, nodesStore, baseDogsMap);

    // === MCP + Actions BEFORE `/:kennelId` ===
    // Otherwise POST /mcp matches KennelRunHandler's `/:kennelId` first (kennelId=mcp).
    const baseDogsList = allBaseDogs.map((dog) => ({
        id: 'base:' + dog.name,
        name: dog.name,
        description: dog.description,
        type: 'BaseDog' as const,
        icon: dog.icon,
    }));
    // Single snapshot cache shared between MCP and the OpenAPI Actions transport —
    // a kennel refreshed via one is visible to the other.
    const snapshotCache = new KennelSnapshotCache();
    const toolDeps = {
        kennelsController,
        nodesController,
        kennelRunHandler,
        kennelsStore,
        nodesStore,
        prisma: authPrisma,
        baseDogsList,
        projectRoot: __dirname,
        snapshotCache,
    };
    app.use('/mcp', createMcpRouter(toolDeps));
    app.use('/actions', createActionsRouter(toolDeps));

    kennelSwaggerHandler.registerRoutes(app);
    kennelBundleHandler.registerRoutes(app);
    kennelRunHandler.registerRoutes(app);

    // SPA-Fallback (Angular): Express 5 — kein app.get('*', …). Keine Kollision mit /api, /static (siehe spaRouteConstants).
    if (angularBrowserDir) {
        app.use((req: any, res: any, next: any) => {
            if (req.method !== 'GET') return next();
            const p = req.path as string;
            if (SPA_FALLBACK_SKIP_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`))) {
                return next();
            }
            res.sendFile(path.join(angularBrowserDir, 'index.html'));
        });
    }

    // Eigener http.Server, damit der ChannelHub seinen WebSocketServer per Upgrade-Handler anhaengen kann.
    const httpServer = http.createServer(app);
    await channelHub.attach(httpServer);

    console.log('App started.');
    // Render u. a.: öffentlich erreichbar nur bei Bind an 0.0.0.0; PORT kommt von der Plattform.
    httpServer.listen(port, '0.0.0.0', () => {
        const base = `http://localhost:${port}`;
        if (!serveBuiltAngular) {
            console.log(`API ${base} — Dev-UI-Redirect: ${base}/ → ${devUiOrigin}/`);
        }
        console.log(`Server läuft auf Port ${port}`);
    });
}
