import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';
import type { KennelRunAttribution } from '../api/routes/KennelRunHandler';
import { isHtmlResultString } from '../services/leadResultStringFormat';

/** Wer die Lead-Ausgabe eines Kennels liefert — der KennelRunHandler (P5: `runLeadAsAnonymous`). */
export interface LandingRunner {
    runLeadAsAnonymous(kennelId: string, query: Record<string, string>, attribution: KennelRunAttribution): Promise<unknown | null>;
}

export interface LandingPageOptions {
    /** `public/` — dort liegt der statische Fallback `landing/index.html`. */
    publicDir: string | null;
    /** Env LANDING_KENNEL_ID, Default `slopdogs-landing`. */
    kennelId: string;
    /** Env LANDING_HTML_MEMO_MS, Default 300000. */
    memoMs: number;
    now?: () => number;
}

/** Die gemerkte Seite eines Kennels. `html: null` = Kennel fehlt oder lieferte nichts — bis `at + memoMs` gilt der Fallback. */
interface LandingMemoEntry {
    html: string | null;
    at: number;
}

export interface LandingPageResult {
    html: string;
    source: 'kennel' | 'fallback';
}

function positiveIntFromEnv(name: string, fallback: number): number {
    const parsed = Number.parseInt((process.env[name] || '').trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * `/` ist ein Kennel (PLAN P5, Dogfooding): die Lead-Ausgabe von `slopdogs-landing` (nur Mixtape, kein Look-Parameter)
 * aus einem HTML-Memo. Kein Lauf je Besuch — ein Lauf je Memo-Fenster; ist das Fenster um, bekommt
 * der Besucher die gemerkte Seite sofort und der Lauf erneuert sie im Hintergrund. Der Lauf zaehlt mit der
 * Quelle `landing` (rankt nicht). Scheitert er oder fehlt der Kennel, liefert `/` den statischen Fallback
 * `public/landing/index.html` (die gebaute Mixtape-Seite) — die Seite ist nie leer.
 * Der Host (`‹host›` in der Ausgabe) kommt je Anfrage aus MCP_BASE_URL bzw. dem Request, nie ins Memo.
 */
export class LandingPage {
    static readonly DEFAULT_KENNEL_ID = 'slopdogs-landing';
    static readonly DEFAULT_MEMO_MS = 300_000;
    static readonly CACHE_CONTROL = 'public, max-age=300';
    /** So zeigen die Skins den Platzhalter `<host>` an. */
    static readonly HOST_MARK = '‹host›';

    readonly kennelId: string;
    readonly memoMs: number;
    private readonly now: () => number;
    private readonly fallbackFile: string | null;
    private fallbackHtml: string | null = null;
    private runner: LandingRunner | null = null;
    private readonly memo = new Map<string, LandingMemoEntry>();
    private readonly inFlight = new Map<string, Promise<LandingMemoEntry>>();
    private runCount = 0;

    constructor(options: LandingPageOptions) {
        this.kennelId = options.kennelId;
        this.memoMs = options.memoMs;
        this.now = options.now ?? (() => Date.now());
        this.fallbackFile = options.publicDir ? path.join(options.publicDir, 'landing', 'index.html') : null;
    }

    static fromEnv(publicDir: string | null): LandingPage {
        return new LandingPage({
            publicDir,
            kennelId: (process.env.LANDING_KENNEL_ID || '').trim() || LandingPage.DEFAULT_KENNEL_ID,
            memoMs: positiveIntFromEnv('LANDING_HTML_MEMO_MS', LandingPage.DEFAULT_MEMO_MS),
        });
    }

    /** Der Lauf-Lieferant kommt nach dem Montieren der Routen (createHttpApplication); bis dahin gilt der Fallback. */
    useRunner(runner: LandingRunner): void {
        this.runner = runner;
    }

    /** Wie viele Kennel-Laeufe die Landing ausgeloest hat — Messpunkt fuer "kein Lauf je Besuch". */
    get runs(): number {
        return this.runCount;
    }

    /**
     * Die Seite: frisch aus dem Memo; abgelaufen aus dem Memo mit Refresh im Hintergrund; ohne Memo ein Lauf
     * (hoechstens einer gleichzeitig). `null` nur, wenn weder Kennel noch Fallback da sind.
     */
    async page(): Promise<LandingPageResult | null> {
        const entry = this.memo.get(this.kennelId);
        if (entry) {
            if (this.now() - entry.at >= this.memoMs) void this.refresh(this.kennelId);
            return this.resultOf(entry);
        }
        if (!this.runner) return this.resultOf({ html: null, at: 0 });
        return this.resultOf(await this.refresh(this.kennelId));
    }

    async handleGet(req: Request, res: Response, next: NextFunction): Promise<void> {
        let page: LandingPageResult | null;
        try {
            page = await this.page();
        } catch (err) {
            console.error('[LandingPage]', err);
            page = this.resultOf({ html: null, at: 0 });
        }
        if (!page) {
            next();
            return;
        }
        this.setHeaders(res, page.source);
        res.status(200).send(LandingPage.withHost(page.html, LandingPage.baseOf(req)));
    }

    /** HEAD / (Keepalive, ki-fruechte): nie ein Lauf — nur, was Memo oder Fallback schon haben. */
    handleHead(_req: Request, res: Response, next: NextFunction): void {
        const entry = this.memo.get(this.kennelId);
        const page = this.resultOf(entry ?? { html: null, at: 0 });
        if (!page) {
            next();
            return;
        }
        this.setHeaders(res, page.source);
        res.status(200).end();
    }

    /** `https://‹host›` wird die Basis-URL, jedes weitere `‹host›` ihr Host; ohne gueltige Basis bleibt der Platzhalter. */
    static withHost(html: string, base: URL | null): string {
        if (!base) return html;
        return html.split(`https://${LandingPage.HOST_MARK}`).join(base.origin).split(LandingPage.HOST_MARK).join(base.host);
    }

    /** Die oeffentliche Basis: MCP_BASE_URL, sonst Protokoll + Host der Anfrage — nur, was als Host taugt. */
    static baseOf(req: Request): URL | null {
        const raw = process.env.MCP_BASE_URL?.trim() || `${req.protocol}://${req.get('host') ?? ''}`;
        try {
            const url = new URL(raw);
            if (!/^https?:$/.test(url.protocol) || !/^[a-z0-9.:\-[\]]+$/i.test(url.host)) return null;
            return url;
        } catch {
            return null;
        }
    }

    private setHeaders(res: Response, source: LandingPageResult['source']): void {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', LandingPage.CACHE_CONTROL);
        res.setHeader('X-Landing-Source', source);
    }

    private resultOf(entry: LandingMemoEntry): LandingPageResult | null {
        if (entry.html) return { html: entry.html, source: 'kennel' };
        const fallback = this.fallback();
        return fallback ? { html: fallback, source: 'fallback' } : null;
    }

    /** Die gebaute Seite; einmal gelesen, danach aus dem Speicher. */
    private fallback(): string | null {
        if (this.fallbackHtml !== null) return this.fallbackHtml;
        if (!this.fallbackFile || !fs.existsSync(this.fallbackFile)) return null;
        this.fallbackHtml = fs.readFileSync(this.fallbackFile, 'utf8');
        return this.fallbackHtml;
    }

    /**
     * Ein Lauf je Kennel zur Zeit. Wirft er, bleibt eine vorhandene Seite fuer ein weiteres Fenster stehen, sonst gilt
     * der Fallback; liefert er nichts (Kennel weg, Lead ohne HTML), gilt der Fallback — auch nach einer guten Seite.
     */
    private refresh(kennelId: string): Promise<LandingMemoEntry> {
        const running = this.inFlight.get(kennelId);
        if (running) return running;
        const previous = this.memo.get(kennelId);
        const run = this.render(kennelId)
            .catch((err) => {
                console.warn(`[LandingPage] ${kennelId}: Lauf gescheitert —`, (err as Error)?.message ?? err);
                return previous?.html ?? null;
            })
            .then((html) => {
                const entry: LandingMemoEntry = { html, at: this.now() };
                this.memo.set(kennelId, entry);
                return entry;
            })
            .finally(() => {
                if (this.inFlight.get(kennelId) === run) this.inFlight.delete(kennelId);
            });
        this.inFlight.set(kennelId, run);
        return run;
    }

    private async render(kennelId: string): Promise<string | null> {
        if (!this.runner) return null;
        this.runCount += 1;
        const startedAt = Date.now();
        const rssBefore = process.memoryUsage().rss;
        const result = await this.runner.runLeadAsAnonymous(kennelId, {}, { source: 'landing' });
        const html = typeof result === 'string' && isHtmlResultString(result) ? result : null;
        const mb = (bytes: number) => Math.round(bytes / 1048576);
        console.log(`[LandingPage] ${kennelId}: ${html ? `${Buffer.byteLength(html)} B` : 'keine HTML-Ausgabe (Fallback)'} in ${Date.now() - startedAt} ms, RSS ${mb(rssBefore)} -> ${mb(process.memoryUsage().rss)} MB`);
        return html;
    }
}
