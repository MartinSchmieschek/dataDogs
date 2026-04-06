/**
 * ~~~ PRISMA CACHE HANDLER — persistent memory via dieselben ORM-Pfade wie der Store ~~~
 *
 * Eigene SQLite-Datei (CACHE_DATABASE_URL), Schema: store/prisma-cache/schema.prisma.
 * Kein zweites natives SQL-API — nur Prisma.
 */

import { PrismaClient } from '../store/generated/prisma-cache-client';
import { ICacheHandler, IAreaCache } from '@datadogs/core';
import { AreaCacheStrategy } from './AreaCacheStrategy';

export class PrismaCacheHandler implements ICacheHandler {
    private prisma: PrismaClient;
    private inflight = new Map<string, Promise<unknown>>();
    private pruneTimer: ReturnType<typeof setInterval>;
    private areaCaches = new Map<string, AreaCacheStrategy<unknown>>();

    constructor(cacheDatabaseUrl: string, pruneIntervalMs: number = 60_000) {
        this.prisma = new PrismaClient({
            datasources: { db: { url: cacheDatabaseUrl } },
        });

        this.pruneTimer = setInterval(() => {
            void this.prune().catch((e) => console.error('[PrismaCacheHandler] prune', e));
        }, pruneIntervalMs);
        if (this.pruneTimer && typeof this.pruneTimer === 'object' && 'unref' in this.pruneTimer) {
            this.pruneTimer.unref();
        }
    }

    getAreaCache<T>(): IAreaCache<T> {
        const key = '__shared__';
        let cache = this.areaCaches.get(key);
        if (!cache) {
            cache = new AreaCacheStrategy<unknown>();
            this.areaCaches.set(key, cache);
        }
        return cache as IAreaCache<T>;
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
        const cached = await this.get<T>(key);
        if (cached !== undefined) {
            console.log(`[PrismaCacheHandler] HIT: ${key}`);
            return cached;
        }

        const existing = this.inflight.get(key);
        if (existing) {
            console.log(`[PrismaCacheHandler] DEDUP: ${key} (waiting for in-flight request)`);
            return existing as Promise<T>;
        }

        console.log(`[PrismaCacheHandler] MISS: ${key} (fetching)`);
        const promise = factory()
            .then(async (result) => {
                await this.set(key, result, ttlMs);
                this.inflight.delete(key);
                console.log(`[PrismaCacheHandler] STORED: ${key} (TTL: ${Math.round(ttlMs / 1000)}s)`);
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
        if (res.count > 0) {
            console.log(`[PrismaCacheHandler] PRUNED: ${res.count} expired entries`);
        }
    }
}
