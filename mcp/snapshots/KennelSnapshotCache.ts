// KennelSnapshotCache — Gedaechtnis ohne Stein.
// Map im Prozessspeicher, LRU + Idle-TTL. Keine Persistenz, kein Timer.
// Eviction laeuft lazy — wer get() ruft, weckt den Aufraeumer.

import type { IKennelConfig } from '@datadogs/core';
import type { Waves } from '../../services/WavesConverter';
import type { KennelSnapshotEntry } from './types';

interface CacheOptions {
    maxEntries?: number;
    idleTtlMs?: number;
}

interface MarkOkParams {
    waves: Waves;
    kennelConfig: IKennelConfig;
    leadDogId?: string;
    leadResult?: unknown;
}

export class KennelSnapshotCache {
    private readonly entries = new Map<string, KennelSnapshotEntry>();
    private readonly maxEntries: number;
    private readonly idleTtlMs: number;

    constructor(options: CacheOptions = {}) {
        this.maxEntries = options.maxEntries ?? 200;
        this.idleTtlMs = options.idleTtlMs ?? 30 * 60 * 1000;
    }

    /** Starte einen Run — markiere die Hoehle, in der das Echo eintrifft. */
    startJob(
        lineageId: string,
        kennelVersionId: string,
        query: Record<string, string> | undefined,
        body: unknown,
        triggerUserId: string | null | undefined,
    ): void {
        const now = new Date();
        const entry: KennelSnapshotEntry = {
            kennelLineageId: lineageId,
            kennelVersionId,
            status: 'running',
            startedAt: now,
            lastAccessedAt: now,
            query,
            body,
            triggerUserId: triggerUserId ?? null,
        };
        this.entries.set(lineageId, entry);
        this.evict();
    }

    /** Beute trifft ein. */
    markOk(lineageId: string, params: MarkOkParams): void {
        const entry = this.entries.get(lineageId);
        if (!entry) return;
        const now = new Date();
        entry.status = 'ok';
        entry.finishedAt = now;
        entry.durationMs = now.getTime() - entry.startedAt.getTime();
        entry.waves = params.waves;
        entry.kennelConfig = params.kennelConfig;
        entry.leadDogId = params.leadDogId;
        entry.leadResult = params.leadResult;
        entry.lastAccessedAt = now;
    }

    /** Der Run zerbarst — markiere den Fehler. */
    markFailed(lineageId: string, error: string): void {
        const entry = this.entries.get(lineageId);
        if (!entry) return;
        const now = new Date();
        entry.status = 'failed';
        entry.finishedAt = now;
        entry.durationMs = now.getTime() - entry.startedAt.getTime();
        entry.errorMessage = error;
        entry.lastAccessedAt = now;
    }

    /** Lese — und beruehre die LRU-Asche. */
    get(lineageId: string): KennelSnapshotEntry | undefined {
        this.evict();
        const entry = this.entries.get(lineageId);
        if (entry) {
            entry.lastAccessedAt = new Date();
        }
        return entry;
    }

    has(lineageId: string): boolean {
        return this.entries.has(lineageId);
    }

    delete(lineageId: string): void {
        this.entries.delete(lineageId);
    }

    /** Lazy eviction — idle entries verfallen, ueberzaehlige fallen aelteste-zuerst. */
    private evict(): void {
        const now = Date.now();

        // 1. Idle-Verfall.
        for (const [key, entry] of this.entries) {
            const idle = now - entry.lastAccessedAt.getTime();
            if (idle > this.idleTtlMs) {
                this.entries.delete(key);
            }
        }

        // 2. Ueberlauf — die Aeltesten gehen.
        if (this.entries.size <= this.maxEntries) return;
        const sorted = Array.from(this.entries.entries())
            .sort((a, b) => a[1].lastAccessedAt.getTime() - b[1].lastAccessedAt.getTime());
        const overflow = this.entries.size - this.maxEntries;
        for (let i = 0; i < overflow; i++) {
            this.entries.delete(sorted[i][0]);
        }
    }
}
