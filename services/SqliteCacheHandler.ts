/**
 * ~~~ THE SQLITE CACHE HANDLER — persistent memory of the abyss ~~~
 *
 * Arr, unlike its Map-backed kin, this cache persists its plunder
 * in a SQLite file — so even when the ship sinks and rises again,
 * the hold remembers what was seized. Each entry carries a TTL;
 * when the rot sets in, the cache forgets upon next access.
 *
 * The dark heart: getOrFetch() still deduplicates in-flight requests
 * in memory, but the resolved values are written to disk.
 */

import Database from 'better-sqlite3';
import { ICacheHandler, IAreaCache } from '@datadogs/core';
import { AreaCacheStrategy } from './AreaCacheStrategy';

export class SqliteCacheHandler implements ICacheHandler {
    private db: Database.Database;
    private inflight = new Map<string, Promise<unknown>>();
    private pruneTimer: ReturnType<typeof setInterval>;
    private areaCaches = new Map<string, AreaCacheStrategy<unknown>>();

    constructor(dbPath: string, pruneIntervalMs: number = 60_000) {
        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS cache (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                expires_at INTEGER NOT NULL
            )
        `);

        this.pruneTimer = setInterval(() => this.prune(), pruneIntervalMs);
        if (this.pruneTimer && typeof this.pruneTimer === 'object' && 'unref' in this.pruneTimer) {
            this.pruneTimer.unref();
        }
    }

    get<T>(key: string): T | undefined {
        const row = this.db.prepare('SELECT value, expires_at FROM cache WHERE key = ?').get(key) as
            | { value: string; expires_at: number }
            | undefined;
        if (!row) return undefined;
        if (Date.now() >= row.expires_at) {
            this.db.prepare('DELETE FROM cache WHERE key = ?').run(key);
            return undefined;
        }
        return JSON.parse(row.value) as T;
    }

    set<T>(key: string, value: T, ttlMs: number): void {
        const expiresAt = Date.now() + ttlMs;
        this.db
            .prepare('INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)')
            .run(key, JSON.stringify(value), expiresAt);
    }

    has(key: string): boolean {
        return this.get(key) !== undefined;
    }

    getOrFetch<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
        // 1. Cache-Hit — plunder already in the hold
        const cached = this.get<T>(key);
        if (cached !== undefined) {
            console.log(`[SqliteCacheHandler] HIT: ${key}`);
            return Promise.resolve(cached);
        }

        // 2. In-flight request — share its Promise
        const existing = this.inflight.get(key);
        if (existing) {
            console.log(`[SqliteCacheHandler] DEDUP: ${key} (waiting for in-flight request)`);
            return existing as Promise<T>;
        }

        // 3. Cache miss — sail forth, persist the spoils on return
        console.log(`[SqliteCacheHandler] MISS: ${key} (fetching)`);
        const promise = factory()
            .then(result => {
                this.set(key, result, ttlMs);
                this.inflight.delete(key);
                console.log(`[SqliteCacheHandler] STORED: ${key} (TTL: ${Math.round(ttlMs / 1000)}s)`);
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
        this.db.prepare('DELETE FROM cache WHERE key = ?').run(key);
    }

    invalidateByPrefix(prefix: string): void {
        this.db.prepare('DELETE FROM cache WHERE key LIKE ?').run(prefix + '%');
    }

    prune(): void {
        const deleted = this.db.prepare('DELETE FROM cache WHERE expires_at <= ?').run(Date.now());
        if (deleted.changes > 0) {
            console.log(`[SqliteCacheHandler] PRUNED: ${deleted.changes} expired entries`);
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
}
