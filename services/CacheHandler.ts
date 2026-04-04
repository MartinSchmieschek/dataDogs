/**
 * ~~~ THE CACHE HANDLER — memory of the abyss ~~~
 *
 * Arr, this be the vessel's memory — a Map-backed cache that remembers
 * plunder already seized from the data seas. Why sail the same cursed
 * waters twice when the hold already brims with treasure?
 *
 * The dark heart: getOrFetch() deduplicates in-flight requests.
 * If two hounds chase the same quarry at once, only one fetch sails
 * forth — the other waits upon the same Promise, sharing the spoils.
 *
 * TTL governs how long plunder stays fresh in the hold.
 * When the rot sets in (expiry), the cache forgets.
 */

import { ICacheHandler, IAreaCache } from '@datadogs/core';
import { AreaCacheStrategy } from './AreaCacheStrategy';

interface CacheEntry {
    value: unknown;
    expiresAt: number;
}

export class CacheHandler implements ICacheHandler {
    private store = new Map<string, CacheEntry>();
    private inflight = new Map<string, Promise<unknown>>();
    private pruneTimer: ReturnType<typeof setInterval>;
    private areaCaches = new Map<string, AreaCacheStrategy<unknown>>();

    /** Get or create a shared AreaCacheStrategy — one per logical type, shared across runs. */
    getAreaCache<T>(): IAreaCache<T> {
        const key = '__shared__';
        let cache = this.areaCaches.get(key);
        if (!cache) {
            cache = new AreaCacheStrategy<unknown>();
            this.areaCaches.set(key, cache);
        }
        return cache as IAreaCache<T>;
    }

    constructor(pruneIntervalMs: number = 60_000) {
        // Periodically purge expired entries so the hold doesn't overflow
        this.pruneTimer = setInterval(() => this.prune(), pruneIntervalMs);
        // unref so Node can exit cleanly without waiting for the timer
        if (this.pruneTimer && typeof this.pruneTimer === 'object' && 'unref' in this.pruneTimer) {
            this.pruneTimer.unref();
        }
    }

    get<T>(key: string): T | undefined {
        const entry = this.store.get(key);
        if (!entry) return undefined;
        if (Date.now() >= entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        return entry.value as T;
    }

    set<T>(key: string, value: T, ttlMs: number): void {
        this.store.set(key, {
            value,
            expiresAt: Date.now() + ttlMs,
        });
    }

    has(key: string): boolean {
        return this.get(key) !== undefined;
    }

    getOrFetch<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
        // 1. Cache-Hit — plunder already in the hold
        const cached = this.get<T>(key);
        if (cached !== undefined) {
            console.log(`[CacheHandler] HIT: ${key}`);
            return Promise.resolve(cached);
        }

        // 2. In-flight request — another hound already chases this quarry, share its Promise
        const existing = this.inflight.get(key);
        if (existing) {
            console.log(`[CacheHandler] DEDUP: ${key} (waiting for in-flight request)`);
            return existing as Promise<T>;
        }

        // 3. Cache miss — sail forth, cache the spoils on return
        console.log(`[CacheHandler] MISS: ${key} (fetching)`);
        const promise = factory()
            .then(result => {
                this.set(key, result, ttlMs);
                this.inflight.delete(key);
                console.log(`[CacheHandler] STORED: ${key} (TTL: ${Math.round(ttlMs / 1000)}s)`);
                return result;
            })
            .catch(err => {
                this.inflight.delete(key);
                throw err;
            });

        this.inflight.set(key, promise);
        return promise;
    }

    invalidate(key: string): void {
        this.store.delete(key);
    }

    invalidateByPrefix(prefix: string): void {
        for (const key of this.store.keys()) {
            if (key.startsWith(prefix)) {
                this.store.delete(key);
            }
        }
    }

    prune(): void {
        const now = Date.now();
        for (const [key, entry] of this.store) {
            if (now >= entry.expiresAt) {
                this.store.delete(key);
            }
        }
    }
}
