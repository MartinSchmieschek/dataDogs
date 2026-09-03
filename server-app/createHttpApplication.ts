import express, { type Application } from 'express';
import cookieParser from 'cookie-parser';
import {
    ISerializedDogConfig,
    SerializedDog,
    type ICacheHandler,
} from '@datadogs/core';
import { IStore } from '../store/IStore';
import { Controller } from '../api/Controller';
import { KennelController } from '../api/KennelController';
import { ControllerRegistry, ConfigRouteHandler } from '../api/routes/ConfigRouteHandler';
import { KennelRunHandler } from '../api/routes/KennelRunHandler';
import { KennelSwaggerHandler } from '../api/routes/KennelSwaggerHandler';
import { KennelBundleHandler } from '../api/routes/KennelBundleHandler';
import { NodesRouteHandler } from '../api/routes/NodesRouteHandler';
import { ReadmeRouteHandler } from '../api/routes/ReadmeRouteHandler';
import { StartupTest } from '../StartupTest';
import { PrismaCacheHandler } from '../services/PrismaCacheHandler';
import { withResilientCacheInfra } from '../services/resilientCacheHandler';
import { createPrismaAuthClient } from '../store/createPrismaAuthClient';
import { createSessionMiddleware } from '../mcp/auth/sessions';
import { createAuthRouter } from '../mcp/auth/router';
import { createAuthContextMiddleware } from '../mcp/auth/middleware';
import { createDiscoveryRouter } from '../mcp/auth/discovery';
import { createMcpRouter } from '../mcp/transports/mcp';
import { createActionsRouter } from '../mcp/transports/openapi';
import { KennelSnapshotCache } from '../mcp/snapshots/KennelSnapshotCache';
import { resolveAngularBrowserDir, resolvePublicDir } from './expressPaths';
import type { HttpFrontEndBinder, HttpFrontEndContext } from './httpFrontEndTypes';

export type CreateHttpApplicationInput = {
    nodeEnv: string;
    devUiOrigin: string;
    /** `__dirname` des Einstiegspunkts (main), für ReadmeRouteHandler und Pfadauflösung. */
    serverRootDir: string;
    nodesStore: IStore;
    kennelsStore: IStore;
    allBaseDogs: any[];
    baseDogsMap: Map<string, new () => any>;
    resolveCacheDatabaseUrl: () => string;
};

export type CreateHttpApplicationResult = {
    app: Application;
    serveBuiltAngular: boolean;
    /**
     * Startet die Selbsttest-Suite. Bewusst NICHT waehrend des Aufbaus ausgefuehrt, sondern als
     * Rueckruf gereicht: main.ts ruft ihn ERST NACH httpServer.listen auf. Wirft nie.
     */
    runStartupTests: () => Promise<void>;
};

/**
 * Selbsttests laufen standardmaessig NUR lokal (development): in integration/production schreiben
 * sie Testdaten in die echte Datenbank. Dort nur auf ausdrueckliche Anforderung -- RUN_STARTUP_TESTS=1
 * schaltet sie ueberall ein, RUN_STARTUP_TESTS=0 ueberall aus.
 */
function shouldRunStartupTests(nodeEnv: string): boolean {
    const flag = (process.env.RUN_STARTUP_TESTS || '').trim().toLowerCase();
    if (flag === '1' || flag === 'true') return true;
    if (flag === '0' || flag === 'false') return false;
    return nodeEnv === 'development';
}

/**
 * Baut die Express-App: CORS, JSON, Auth/MCP, /static, umgebungsabhängiges Frontend (dev vs. gebaute SPA),
 * API, Kennel-Run/Swagger/Bundle, SPA-Fallback (nur built UI).
 */
export async function createHttpApplication(input: CreateHttpApplicationInput): Promise<CreateHttpApplicationResult> {
    const { nodeEnv, devUiOrigin, serverRootDir, nodesStore, kennelsStore, allBaseDogs, baseDogsMap } = input;
    const serveBuiltAngular = nodeEnv === 'production' || nodeEnv === 'integration';
    const angularBrowserDir = serveBuiltAngular ? resolveAngularBrowserDir(serverRootDir) : null;

    const frontBinder: HttpFrontEndBinder =
        nodeEnv === 'development'
            ? (await import('./httpFrontEnd.development')).bindHttpFrontEnd
            : (await import('./httpFrontEnd.builtUi')).bindHttpFrontEnd;

    const frontCtx: HttpFrontEndContext = { devUiOrigin, angularBrowserDir };

    const app = express();

    // Hinter Renders TLS-Proxy terminiert HTTPS am Proxy; die App sieht intern HTTP.
    // Ohne `trust proxy` haelt express req.secure fuer false und express-session
    // verweigert das Secure-Cookie -> kein Set-Cookie -> OAuth/PKCE- und
    // Personal-Token-Flow tot. Nur deployed setzen; lokal (development) laeuft
    // alles unveraendert ueber http://localhost ohne Proxy und ohne Login.
    if (nodeEnv === 'production' || nodeEnv === 'integration') {
        app.set('trust proxy', 1);
    }

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

    const authPrisma = createPrismaAuthClient();
    app.use(cookieParser());
    app.use(express.urlencoded({ extended: false, limit: '1mb' }));
    app.use(createSessionMiddleware());
    app.use(createAuthContextMiddleware(authPrisma));
    app.use('/auth', createAuthRouter(authPrisma));
    app.use('/.well-known', createDiscoveryRouter());

    const publicDir = resolvePublicDir(serverRootDir);
    if (publicDir) {
        app.use('/static', express.static(publicDir));
    }

    frontBinder.beforeControllers(app, frontCtx);

    const registry = new ControllerRegistry();
    const nodesController = new Controller<ISerializedDogConfig>(nodesStore, SerializedDog.name);
    const kennelsController = new KennelController(kennelsStore);
    registry.register('nodes', nodesController);
    registry.register('kennels', kennelsController);

    // Die Selbsttest-Suite lief frueher GENAU HIER -- vor dem Montieren aller Routen und vor
    // httpServer.listen. Ein Fehlschlag, ein stiller Kill oder auch nur eine lange Laufzeit hat
    // damit den ganzen Dienst am Hochkommen gehindert: die Plattform sah keinen offenen Port und
    // startete in einer Schleife neu. Ein Selbsttest darf einen Dienst niemals am Start hindern.
    // Deshalb wird er nur noch als Rueckruf gereicht und von main.ts NACH dem Port-Bind gestartet.
    const runStartupTests = async (): Promise<void> => {
        if (!shouldRunStartupTests(input.nodeEnv)) {
            console.log(`[StartupTest] uebersprungen (NODE_ENV=${input.nodeEnv}) -- mit RUN_STARTUP_TESTS=1 erzwingbar.`);
            return;
        }
        try {
            const startupTest = new StartupTest();
            await startupTest.runAllTests(nodesStore, kennelsStore, nodesController, kennelsController, baseDogsMap);
        } catch (err) {
            // Laut scheitern, aber weiterlaufen -- der Dienst ist wichtiger als seine Selbstpruefung.
            console.error('[StartupTest] Suite abgebrochen -- der Dienst laeuft weiter:', err);
        }
    };

    const nodesRouteHandler = new NodesRouteHandler(registry, allBaseDogs);
    nodesRouteHandler.registerRoutes(app);
    const readmeRouteHandler = new ReadmeRouteHandler(serverRootDir);
    readmeRouteHandler.registerRoutes(app);

    const routeHandler = new ConfigRouteHandler(registry, kennelsStore);
    routeHandler.registerRoutes(app, '/api');

    const cacheHandler: ICacheHandler = withResilientCacheInfra(
        new PrismaCacheHandler(input.resolveCacheDatabaseUrl()),
    );

    const kennelRunHandler = new KennelRunHandler({ kennelsController, nodesStore, baseDogsMap, cacheHandler });
    const kennelSwaggerHandler = new KennelSwaggerHandler(kennelRunHandler);
    const kennelBundleHandler = new KennelBundleHandler(kennelRunHandler, kennelsController, nodesStore, baseDogsMap);

    const baseDogsList = allBaseDogs.map((dog) => ({
        id: 'base:' + dog.name,
        name: dog.name,
        description: dog.description,
        type: 'BaseDog' as const,
        icon: dog.icon,
    }));
    const snapshotCache = new KennelSnapshotCache();
    const toolDeps = {
        kennelsController,
        nodesController,
        kennelRunHandler,
        kennelsStore,
        nodesStore,
        prisma: authPrisma,
        baseDogsList,
        projectRoot: serverRootDir,
        snapshotCache,
    };
    app.use('/mcp', createMcpRouter(toolDeps));
    app.use('/actions', createActionsRouter(toolDeps));

    kennelSwaggerHandler.registerRoutes(app);
    kennelBundleHandler.registerRoutes(app);
    kennelRunHandler.registerRoutes(app);

    frontBinder.afterKennelRoutes(app, frontCtx);

    return { app, serveBuiltAngular, runStartupTests };
}
