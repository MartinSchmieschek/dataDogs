/**
 * ~~~ PRISMA CACHE HANDLER — persistent memory via dieselben ORM-Pfade wie der Store ~~~
 *
 * Eigene DB (CACHE_DATABASE_URL), Schema: store/prisma-cache/schema.prisma.
 * Kein zweites natives SQL-API — nur Prisma.
 *
 * Enthaelt zwei Caches:
 *  - CacheEntry (key/value) fuer klassische getOrFetch-Calls mit TTL + in-flight-dedup.
 *    Enthaelt Negative-Caching (60s) fuer Provider-Errors wie Overpass 429/504 —
 *    verhindert den Retry-Sturm wenn upstream rate-limited.
 *  - PrismaTileFeatureCache fuer atomaren OSM-Feature-Store via Slippy-Map-Tiles.
 *
 * Client-Pfad: immer relativ zum Projektroot (process.cwd()), damit dist/main.js nicht
 * nach dist/store/generated sucht — Prisma legt unter store/generated/ ab.
 */

import path from 'path';
import type { PrismaClient } from '../store/generated/prisma-cache-client';
import { ICacheHandler, isRuntimeLogVerbose, type ITileFeatureCache } from '@datadogs/core';
import { PrismaTileFeatureCache } from './PrismaTileFeatureCache';

function createPrismaCacheClient(dbUrl: string): PrismaClient {
    const mod = require(path.join(process.cwd(), 'store/generated/prisma-cache-client')) as typeof import('../store/generated/prisma-cache-client');
    return new mod.PrismaClient({
        datasources: { db: { url: dbUrl } },
    });
}

/** Negative-Cache TTL fuer Provider-Errors — kurz genug um sich schnell zu erholen,
 *  lang genug um einen Retry-Sturm zu brechen. */
const NEGATIVE_CACHE_TTL_MS = 60_000;

/** Marker-Payload im Cache; wenn gelesen loesen wir den originalen Error aus. */
const NEGATIVE_MARKER_PREFIX = '__DATADOGS_NEG_CACHE__:';

function isTransientProviderError(err: unknown): boolean {
    if (!err) return false;
    const msg = (err as Error)?.message ?? String(err);
    // Overpass/OpenMeteo/Nominatim typische Muster: 429, 502, 503, 504, timeouts.
    return /(\b429\b|\b502\b|\b503\b|\b504\b|timeout|timed\s*out|ETIMEDOUT|ECONNRESET|EAI_AGAIN|rate\s*limit)/i.test(
        msg,
    );
}

export class PrismaCacheHandler implements ICacheHandler {
    private prisma: PrismaClient;
    private inflight = new Map<string, Promise<unknown>>();
    private pruneTimer: ReturnType<typeof setInterval>;
    private tileFeatureCache: PrismaTileFeatureCache;

    constructor(cacheDatabaseUrl: string, pruneIntervalMs: number = 60_000) {
        this.prisma = createPrismaCacheClient(cacheDatabaseUrl);
        this.tileFeatureCache = new PrismaTileFeatureCache(this.prisma);

        this.pruneTimer = setInterval(() => {
            void this.prune().catch((e) => console.error('[PrismaCacheHandler] prune', e));
        }, pruneIntervalMs);
        if (this.pruneTimer && typeof this.pruneTimer === 'object' && 'unref' in this.pruneTimer) {
            this.pruneTimer.unref();
        }
    }

    getTileFeatureCache(): ITileFeatureCache {
        return this.tileFeatureCache;
    }

    async get<T>(key: string): Promise<T | undefined> {
        const row = await this.prisma.cacheEntry.findUnique({ where: { key } });
        if (!row) return undefined;
        if (Date.now() >= Number(row.expiresAt)) {
            await this.prisma.cacheEntry.delete({ where: { key } });
            return undefined;
        }
        // Negative-Marker werden fuer externe get()-Aufrufer wie Miss behandelt.
        if (row.value.startsWith('"' + NEGATIVE_MARKER_PREFIX)) {
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

        const cached = await this.getWithNegativeCheck<T>(key);
        if (cached !== undefined) {
            if (cached.kind === 'hit') {
                if (v) console.log(`[PrismaCacheHandler] HIT: ${key}`);
                return cached.value;
            }
            if (v) console.log(`[PrismaCacheHandler] NEG-HIT: ${key} (${cached.message})`);
            throw new Error(cached.message);
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
            .catch(async (err) => {
                this.inflight.delete(key);
                if (isTransientProviderError(err)) {
                    // Kurzer Negative-Cache-Eintrag — stoppt den Retry-Sturm,
                    // laeuft naturgemaess schnell wieder ab.
                    const msg = (err as Error)?.message ?? String(err);
                    await this.set(
                        key,
                        NEGATIVE_MARKER_PREFIX + msg,
                        NEGATIVE_CACHE_TTL_MS,
                    );
                    if (v) console.log(`[PrismaCacheHandler] NEG-STORED: ${key} (${msg.slice(0, 80)})`);
                }
                throw err;
            });

        this.inflight.set(key, promise);
        return promise;
    }

    /** Liest Cache und unterscheidet Hit / Negative-Hit / Miss. */
    private async getWithNegativeCheck<T>(
        key: string,
    ): Promise<{ kind: 'hit'; value: T } | { kind: 'negative'; message: string } | undefined> {
        const row = await this.prisma.cacheEntry.findUnique({ where: { key } });
        if (!row) return undefined;
        if (Date.now() >= Number(row.expiresAt)) {
            await this.prisma.cacheEntry.delete({ where: { key } });
            return undefined;
        }
        const raw = row.value;
        if (typeof raw === 'string' && raw.startsWith('"' + NEGATIVE_MARKER_PREFIX)) {
            // Negative-Marker ist als JSON-String gespeichert (JSON.stringify).
            const decoded = JSON.parse(raw) as string;
            return { kind: 'negative', message: decoded.slice(NEGATIVE_MARKER_PREFIX.length) };
        }
        return { kind: 'hit', value: JSON.parse(raw) as T };
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
        await this.tileFeatureCache.prune();
    }
}
