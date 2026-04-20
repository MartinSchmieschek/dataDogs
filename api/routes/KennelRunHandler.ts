// The KennelRunHandler — the huntmaster who unleashes the hounds.
// Vome speaks: to cosmic madness laws submit — the waves obey the dependency graph.
import {
    SerializedDog,
    MimicDog,
    type IMimicDogConfig,
    IKennelConfig,
    KennelRun,
    type MimicAdopter,
    type ICacheHandler,
    isRuntimeLogVerbose,
} from '@datadogs/core';
import { RESERVED_TOP_LEVEL_SEGMENTS } from './spaRouteConstants';
import { IStore } from '../../store/IStore';
import { KennelController } from '../KennelController';
import { convertSeasonToWaves, Waves } from '../../services/WavesConverter';
import { isHtmlResultString, isMarkdownResultString } from '../../services/leadResultStringFormat';

/** Lead-Yield mit { snapshot, live } — Lobby-Konvention fuer den Socket-Dog. */
function isLobbyLeadShape(v: any): boolean {
    return !!v && typeof v === 'object' && typeof v.live === 'string' && typeof v.snapshot === 'object' && v.snapshot !== null;
}

function clientWantsJson(req: any): boolean {
    if (!req) return false;
    const q = req.query || {};
    if (q.format === 'json' || q.data === '1' || q.data === 'true') return true;
    const accept = String(req.headers?.accept || '').toLowerCase();
    if (!accept) return false;
    if (accept.includes('text/html')) return false;
    if (accept.includes('application/json')) return true;
    return false;
}
import { generateVersionId, generateLineageId } from '../utils/versioning';

/** The provisions required to arm the KennelRunHandler. */
export interface IKennelRunDeps {
    kennelsController: KennelController;
    nodesStore: IStore;
    baseDogsMap: Map<string, new () => any>;
    cacheHandler?: ICacheHandler;
}

export class KennelRunHandler {
    private deps: IKennelRunDeps;

    constructor(deps: IKennelRunDeps) {
        this.deps = deps;
    }

    /** Register run, execute, and public kennel routes. */
    registerRoutes(app: any): void {
        app.get('/api/kennels/:id/run', (req: any, res: any) => this.handleRun(req, res));
        app.post('/api/kennels/:id/run', (req: any, res: any) => this.handleRun(req, res));
        app.get('/api/kennels/:id/execute', (req: any, res: any) => this.handleExecute(req, res));
        app.post('/api/kennels/:id/execute', (req: any, res: any) => this.handleExecute(req, res));
        app.get('/:kennelId', (req: any, res: any, next: any) => void this.handlePublicGet(req, res, next));
        app.post('/:kennelId', (req: any, res: any, next: any) =>
            void this.handlePublicPost(req, res, next),
        );
    }

    // --- Public helpers (used by KennelSwaggerHandler and KennelBundleHandler) ---

    /** Fetch a kennel config, optionally a specific version. */
    public async loadKennelConfig(id: string, versionOverride?: string): Promise<IKennelConfig | null> {
        const lookupId = versionOverride || id;
        const result = await this.deps.kennelsController.getById(lookupId);
        return (result.ok && result.data) ? result.data : null;
    }

    /** Merge default + request query params (all lowercased). */
    public mergeQueryParams(defaults: Record<string, string> | undefined, reqQuery: Record<string, any>): Record<string, string> {
        const result: Record<string, string> = {};
        if (defaults) {
            Object.entries(defaults).forEach(([k, v]) => { result[k.toLowerCase()] = String(v).toLowerCase(); });
        }
        Object.keys(reqQuery).forEach(key => {
            const val = typeof reqQuery[key] === 'string' ? reqQuery[key] : String(reqQuery[key]);
            result[key.toLowerCase()] = val.toLowerCase();
        });
        return result;
    }

    /** Run a kennel and return waves. */
    public async runKennel(config: IKennelConfig, query?: Record<string, string>, body?: any): Promise<Waves> {

        const mimicAdopter = await this.createMimicAdopter(config);

        const kennelRun = new KennelRun(
            config,
            this.deps.baseDogsMap,
            this.createSerializedDogFactory(),
            query || {},
            body,
            [],
            this.deps.cacheHandler,
            mimicAdopter
        );
        const season = await kennelRun.run();
        await this.persistNewMimics(config, season.exhausted);
        return convertSeasonToWaves(season);
    }

    /**
     * Build an adopter that reuses saved MimicDogs instead of conjuring fresh placeholders.
     *
     * Strategy (option c — lineage-aware adoption):
     *   1. Collect every non-base dogId this kennel has ever carried across all its versions.
     *      This is the kennel's "memory" — mimic lineageIds it used to own before the UI (or
     *      any client) dropped them from dogIds on a later PUT.
     *   2. When autoMimic asks for a mimic of pact X, query the deep for all MimicDog lineages
     *      whose config.imitates === X.
     *   3. Prefer a candidate whose lineageId is in the kennel's memory (optionally augmented
     *      with the caller's hint set). Tie-break on newest createdAt. Fall back to the
     *      newest match overall if nothing is remembered.
     *
     * The returned mimic carries its stable lineageId; persistNewMimics later heals it back
     * into config.dogIds so the kennel remembers it on subsequent runs without re-adopting.
     */
    private async createMimicAdopter(config: IKennelConfig): Promise<MimicAdopter> {
        const { nodesStore, kennelsController } = this.deps;

        // Assemble the kennel's lineage memory from every historical version.
        const remembered = new Set<string>();
        const kennelLineageId = (config as any).lineageId || config.id;
        try {
            const versions = await kennelsController.getVersions(kennelLineageId);
            for (const v of versions) {
                const dogIds = (v.config as IKennelConfig)?.dogIds ?? [];
                for (const id of dogIds) {
                    if (typeof id === 'string' && !id.startsWith('base:')) {
                        remembered.add(id);
                    }
                }
            }
        } catch (err) {
            if (isRuntimeLogVerbose()) {
                console.warn('[KennelRunHandler.createMimicAdopter] history lookup failed:', err);
            }
        }

        return async (pactName, preferredLineageIds) => {
            // Union the kennel's own memory with any hint the core passed in.
            const memory = new Set<string>(remembered);
            preferredLineageIds.forEach(id => memory.add(id));

            // Pull every latest MimicDog from the deep and keep only ones that imitate this pact.
            const rows = await nodesStore.findLatestVersionsByType(MimicDog.name);
            type Candidate = {
                versionId: string;
                lineageId: string;
                createdAt: number;
                cfg: IMimicDogConfig;
            };
            const candidates: Candidate[] = [];
            for (const row of rows as any[]) {
                const raw = typeof row.serializedDogConfig === 'string'
                    ? (() => { try { return JSON.parse(row.serializedDogConfig); } catch { return null; } })()
                    : row.serializedDogConfig;
                if (!raw || raw.imitates !== pactName) continue;
                const lineageId = raw.lineageId || row.lineageId || row.id;
                if (!lineageId) continue;
                const createdAt = row.createdAt ? new Date(row.createdAt).getTime() : 0;
                candidates.push({
                    versionId: row.id,
                    lineageId,
                    createdAt,
                    cfg: raw as IMimicDogConfig,
                });
            }
            if (candidates.length === 0) return null;

            // Option (c): remembered lineages win; tie-break by newest createdAt.
            // If nothing is remembered, fall back to the newest match overall.
            const rememberedCands = candidates.filter(c => memory.has(c.lineageId));
            const pool = rememberedCands.length > 0 ? rememberedCands : candidates;
            pool.sort((a, b) => b.createdAt - a.createdAt);
            const winner = pool[0];

            const mimicCfg: IMimicDogConfig = {
                ...winner.cfg,
                id: winner.cfg.id ?? winner.versionId,
                lineageId: winner.lineageId,
            };
            return new MimicDog<unknown>(mimicCfg, winner.versionId);
        };
    }

    // --- Private internals ---

    private createSerializedDogFactory() {
        const { nodesStore } = this.deps;
        return async (ids: string[]): Promise<Array<SerializedDog<unknown>>> => {
            const [serialized, mimics] = await Promise.all([
                nodesStore.findLatestVersionsByType(SerializedDog.name, ids),
                nodesStore.findLatestVersionsByType(MimicDog.name, ids),
            ]);
            // Deduplicate by lineageId — if a dog exists as both SerializedDog and MimicDog type,
            // keep only the most recent version (MimicDog wins when type was upgraded via save).
            const byLineage = new Map<string, any>();
            for (const sd of [...serialized, ...mimics]) {
                const row = sd as any;
                const cfg = typeof row.serializedDogConfig === 'string'
                    ? JSON.parse(row.serializedDogConfig) : row.serializedDogConfig;
                const lid = cfg.lineageId || row.lineageId || row.id;
                const existing = byLineage.get(lid);
                if (!existing || new Date(row.createdAt) > new Date(existing.createdAt)) {
                    byLineage.set(lid, row);
                }
            }
            return Array.from(byLineage.values()).map((sd: any) => {
                const config = typeof sd.serializedDogConfig === 'string'
                    ? JSON.parse(sd.serializedDogConfig)
                    : sd.serializedDogConfig;
                const imitates = (config as IMimicDogConfig).imitates;
                if (typeof imitates === 'string' && imitates.length > 0) {
                    return new MimicDog(config as IMimicDogConfig, sd.id);
                }
                return new SerializedDog(config, sd.id);
            });
        };
    }

    private async persistNewMimics(config: IKennelConfig, exhausted: any[]): Promise<void> {
        const { nodesStore } = this.deps;
        const currentDogIds = new Set<string>(config.dogIds ?? []);
        const freshLineageIds: string[] = [];
        const adoptedLineageIds: string[] = [];

        for (const dog of exhausted) {
            if (!(dog instanceof MimicDog)) continue;
            const mimic = dog as MimicDog<unknown>;
            const existingLineageId = mimic.instanceConfig?.lineageId;

            if (existingLineageId) {
                // Already persisted in the deep (either from dogIds or adopted via MimicAdopter).
                // If the kennel's dogIds don't yet remember it, heal it in so next run loads it directly.
                if (!currentDogIds.has(existingLineageId)) {
                    adoptedLineageIds.push(existingLineageId);
                    currentDogIds.add(existingLineageId);
                    if (isRuntimeLogVerbose()) {
                        console.log(`[KennelRunHandler] Heal adopted mimic into dogIds (lineageId: ${existingLineageId})`);
                    }
                }
                continue;
            }

            const versionId = generateVersionId();
            const lineageId = generateLineageId();
            const cfg = {
                ...mimic.instanceConfig,
                id: versionId,
                lineageId,
                parentId: null,
                displayName: mimic.instanceConfig?.displayName || mimic.storageId,
            };

            await nodesStore.save({
                id: versionId,
                type: MimicDog.name,
                lineageId,
                parentId: null,
                displayName: cfg.displayName,
                serializedDogConfig: JSON.stringify(cfg),
                createdAt: new Date(),
            });

            mimic.instanceConfig.id = versionId;
            mimic.instanceConfig.lineageId = lineageId;
            mimic.instanceConfig.parentId = null;
            mimic.instanceConfig.displayName = cfg.displayName;

            freshLineageIds.push(lineageId);
            if (isRuntimeLogVerbose()) {
                console.log(`[KennelRunHandler] Persisted new mimic '${cfg.displayName}' (lineageId: ${lineageId})`);
            }
        }

        const addedLineageIds = [...freshLineageIds, ...adoptedLineageIds];
        if (addedLineageIds.length > 0) {
            const updatedDogIds = [...(config.dogIds ?? []), ...addedLineageIds];
            await this.deps.kennelsController.heal(config.id, {
                dogIds: updatedDogIds,
            } as any);
            // Keep the in-memory config in sync so the /run response reflects the heal.
            config.dogIds = updatedDogIds;
        }
    }

    private findDogInWaves(waves: Waves, targetDogId: string) {
        const searchId = targetDogId.startsWith('base:')
            ? targetDogId.substring(5)
            : targetDogId;

        for (const wave of waves) {
            for (const node of wave) {
                if (node.id === searchId ||
                    node.id === targetDogId ||
                    (node as any).lineageId === searchId ||
                    (node as any).lineageId === targetDogId) {
                    return node;
                }
            }
        }
        return null;
    }

    private sendResult(res: any, result: any, req?: any) {
        // Lobby-Shape { snapshot, live }: Browser bekommt das HTML, API-Clients den Snapshot.
        if (isLobbyLeadShape(result)) {
            const wantsJson = clientWantsJson(req);
            if (wantsJson) {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.status(200).json((result as any).snapshot);
                return;
            }
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.status(200).send((result as any).live);
            return;
        }
        if (typeof result === 'string' && isHtmlResultString(result)) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.status(200).send(result);
        } else if (typeof result === 'string' && isMarkdownResultString(result)) {
            res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
            res.status(200).send(result);
        } else {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.status(200).json(result);
        }
    }

    // --- Route handlers ---

    private async handleRun(req: any, res: any): Promise<void> {
        try {
            const config = await this.loadKennelConfig(req.params.id, req.query.version);
            if (!config) {
                res.status(404).json({ ok: false, error: `Kennel ${req.params.id} nicht gefunden` });
                return;
            }

            const query = this.mergeQueryParams(config.defaultQuery, req.query);
            const body =
                req.method === 'POST' && req.body !== undefined && req.body !== null
                    ? req.body
                    : config.defaultBody;

            try {
                const waves = await this.runKennel(config, query, body);
                res.json({ ok: true, waves, kennelConfig: config });
            } catch (runError: any) {
                const msg = runError?.message || String(runError);
                if (msg.includes("Nothing to harvest")) {
                    res.json({ ok: false, error: msg, kennelConfig: config });
                } else {
                    console.error("[KennelRunHandler.handleRun] runKennel", runError);
                    res.status(500).json({ ok: false, error: msg, kennelConfig: config });
                }
            }
        } catch (err) {
            console.error('[KennelRunHandler.handleRun]', err);
            res.status(500).json({ ok: false, error: String(err) });
        }
    }

    private async handleExecute(req: any, res: any): Promise<void> {
        try {
            const config = await this.loadKennelConfig(req.params.id, req.query.version);
            if (!config) {
                res.status(404).json({ error: `Kennel ${req.params.id} nicht gefunden` });
                return;
            }

            const dogIds = config.dogIds || [];
            if (dogIds.length === 0) {
                res.status(400).json({ error: 'Keine Hunde in der Config gefunden' });
                return;
            }

            const queryData = this.mergeQueryParams(config.defaultQuery, req.query);
            const body =
                req.method === 'POST' && req.body !== undefined && req.body !== null
                    ? req.body
                    : config.defaultBody;
            const waves = await this.runKennel(config, queryData, body);

            const firstDog = this.findDogInWaves(waves, dogIds[0]);
            if (!firstDog) {
                res.status(404).json({ error: `Hund ${dogIds[0]} nicht in den Waves gefunden` });
                return;
            }
            this.sendResult(res, firstDog.result, req);
        } catch (err) {
            console.error('[KennelRunHandler.handleExecute]', err);
            res.status(500).json({ error: String(err) });
        }
    }

    private async handlePublicGet(req: any, res: any, next: any): Promise<void> {
        const kennelId = req.params.kennelId;
        if (RESERVED_TOP_LEVEL_SEGMENTS.has(kennelId)) {
            next();
            return;
        }

        try {
            const config = await this.loadKennelConfig(kennelId, req.query.version);
            if (!config) {
                const deferSpa =
                    (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'integration') &&
                    typeof next === 'function';
                if (deferSpa) {
                    next();
                    return;
                }
                res.status(404).json({ error: `Kennel ${kennelId} nicht gefunden` });
                return;
            }

            const dogIds = config.dogIds || [];
            if (dogIds.length === 0) {
                res.status(400).json({ error: 'Keine Hunde in der Config gefunden' });
                return;
            }

            const queryData = this.mergeQueryParams(config.defaultQuery, req.query);
            const waves = await this.runKennel(config, queryData, undefined);
            const firstDog = this.findDogInWaves(waves, dogIds[0]);
            if (!firstDog) {
                res.status(404).json({ error: `Hund ${dogIds[0]} nicht in den Waves gefunden` });
                return;
            }
            this.sendResult(res, firstDog.result, req);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: String(err) });
        }
    }

    private async handlePublicPost(req: any, res: any, next: any): Promise<void> {
        const kennelId = req.params.kennelId;
        if (RESERVED_TOP_LEVEL_SEGMENTS.has(kennelId)) {
            next();
            return;
        }

        try {
            const config = await this.loadKennelConfig(kennelId, req.query.version);
            if (!config) {
                res.status(404).json({ error: `Kennel ${kennelId} nicht gefunden` });
                return;
            }

            const dogIds = config.dogIds || [];
            if (dogIds.length === 0) {
                res.status(400).json({ error: 'Keine Hunde in der Config gefunden' });
                return;
            }

            const queryData = this.mergeQueryParams(config.defaultQuery, req.query);
            const bodyData =
                req.body !== undefined && req.body !== null ? req.body : config.defaultBody;

            const waves = await this.runKennel(config, queryData, bodyData);
            const firstDog = this.findDogInWaves(waves, dogIds[0]);
            if (!firstDog) {
                res.status(404).json({ error: `Hund ${dogIds[0]} nicht in den Waves gefunden` });
                return;
            }
            this.sendResult(res, firstDog.result, req);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: String(err) });
        }
    }
}
