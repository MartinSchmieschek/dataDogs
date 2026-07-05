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
import { PrismaClient as AuthPrismaClient } from '../store/generated/prisma-auth-client';
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
};

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

    const authPrisma = new AuthPrismaClient();
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

    const startupTest = new StartupTest();
    await startupTest.runAllTests(nodesStore, kennelsStore, nodesController, kennelsController, baseDogsMap);

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

    return { app, serveBuiltAngular };
}
