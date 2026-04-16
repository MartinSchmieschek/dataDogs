/**
 * ~~~ PRISMA CACHE HANDLER — persistent memory via dieselben ORM-Pfade wie der Store ~~~
 *
 * Eigene DB (CACHE_DATABASE_URL), Schema: store/prisma-cache/schema.prisma.
 * Kein zweites natives SQL-API — nur Prisma.
 *
 * Enthaelt zwei Caches:
 *  - CacheEntry (key/value) fuer klassische getOrFetch-Calls mit TTL + in-flight-dedup
 *  - GeoAreaCache (center/radius/bbox) ueber PersistentAreaCacheStrategy fuer
 *    geographische Containment-Checks, persistiert ueber Prozess-Restarts hinweg.
 *
 * Client-Pfad: immer relativ zum Projektroot (process.cwd()), damit dist/main.js nicht
 * nach dist/store/generated sucht — Prisma legt unter store/generated/ ab.
 */

import path from 'path';
import type { PrismaClient } from '../store/generated/prisma-cache-client';
import { ICacheHandler, IAreaCache, isRuntimeLogVerbose } from '@datadogs/core';
import { PersistentAreaCacheStrategy } from './PersistentAreaCacheStrategy';

function createPrismaCacheClient(dbUrl: string): PrismaClient {
    const mod = require(path.join(process.cwd(), 'store/generated/prisma-cache-client')) as typeof import('../store/generated/prisma-cache-client');
    return new mod.PrismaClient({
        datasources: { db: { url: dbUrl } },
    });
}

export class PrismaCacheHandler implements ICacheHandler {
    private prisma: PrismaClient;
    private inflight = new Map<string, Promise<unknown>>();
    private pruneTimer: ReturnType<typeof setInterval>;
    private sharedAreaCache: PersistentAreaCacheStrategy<unknown>;

    constructor(cacheDatabaseUrl: string, pruneIntervalMs: number = 60_000) {
        this.prisma = createPrismaCacheClient(cacheDatabaseUrl);
        this.sharedAreaCache = new PersistentAreaCacheStrategy<unknown>(this.prisma);

        this.pruneTimer = setInterval(() => {
            void this.prune().catch((e) => console.error('[PrismaCacheHandler] prune', e));
        }, pruneIntervalMs);
        if (this.pruneTimer && typeof this.pruneTimer === 'object' && 'unref' in this.pruneTimer) {
            this.pruneTimer.unref();
        }
    }

    getAreaCache<T>(): IAreaCache<T> {
        // Ein gemeinsamer persistenter Area-Cache fuer alle Dogs; Partitionierung
        // passiert ueber den `discriminant` innerhalb jedes Eintrags.
        return this.sharedAreaCache as unknown as IAreaCache<T>;
    }

    async get<T>(key: string): Promise<T | undefined> {
        const row = await this.prisma.cacheEntry.findUnique({ where: { key } });
        if (!row) return undefined;
        if (Date.now() >= Number(row.expiresAt)) {
            await this.prisma.cacheEntry.delete({ where: { key } });
            return undefined;
        }
        return JSON.parse(row.value) as T;
    }

    async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
        const expiresAt = BigInt(Date.now() + ttlMs);
        await this.prisma.cacheEntry.upsert({
            where: { key },
            create: { key, value: JSON.stringify(value), expiresAt },
            update: { value: JSON.stringify(value), expiresAt },
        });
    }

    async has(key: string): Promise<boolean> {
        return (await this.get(key)) !== undefined;
    }

    async getOrFetch<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
        const v = isRuntimeLogVerbose();
        const cached = await this.get<T>(key);
        if (cached !== undefined) {
            if (v) console.log(`[PrismaCacheHandler] HIT: ${key}`);
            return cached;
        }

        const existing = this.inflight.get(key);
        if (existing) {
            if (v) console.log(`[PrismaCacheHandler] DEDUP: ${key} (waiting for in-flight request)`);
            return existing as Promise<T>;
        }

        if (v) console.log(`[PrismaCacheHandler] MISS: ${key} (fetching)`);
        const promise = factory()
            .then(async (result) => {
                await this.set(key, result, ttlMs);
                this.inflight.delete(key);
                if (v) console.log(`[PrismaCacheHandler] STORED: ${key} (TTL: ${Math.round(ttlMs / 1000)}s)`);
                return result;
            })
            .catch((err) => {
                this.inflight.delete(key);
                throw err;
            });

        this.inflight.set(key, promise);
        return promise;
    }

    async invalidate(key: string): Promise<void> {
        await this.prisma.cacheEntry.deleteMany({ where: { key } });
    }

    async invalidateByPrefix(prefix: string): Promise<void> {
        await this.prisma.cacheEntry.deleteMany({
            where: { key: { startsWith: prefix } },
        });
    }

    async prune(): Promise<void> {
        const now = BigInt(Date.now());
        const res = await this.prisma.cacheEntry.deleteMany({
            where: { expiresAt: { lte: now } },
        });
        if (res.count > 0 && isRuntimeLogVerbose()) {
            console.log(`[PrismaCacheHandler] PRUNED: ${res.count} expired entries`);
        }
        await this.sharedAreaCache.prune();
    }
}
