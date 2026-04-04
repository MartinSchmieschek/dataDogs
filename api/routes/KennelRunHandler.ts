// The KennelRunHandler — the huntmaster who unleashes the hounds.
// Vome speaks: to cosmic madness laws submit — the waves obey the dependency graph.
import { SerializedDog, MimicDog, type IMimicDogConfig, IKennelConfig, KennelRun } from '@datadogs/core';
import { IStore } from '../../store/IStore';
import { KennelController } from '../KennelController';
import { convertSeasonToWaves, Waves } from '../../services/WavesConverter';
import { kennelVmGlobalsSuppliers } from '../../services/kennelVmGlobals';
import { generateVersionId, generateLineageId } from '../utils/versioning';

/** The provisions required to arm the KennelRunHandler. */
export interface IKennelRunDeps {
    kennelsController: KennelController;
    nodesStore: IStore;
    baseDogsMap: Map<string, new () => any>;
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
        app.get('/:kennelId', (req: any, res: any) => this.handlePublicGet(req, res));
        app.post('/:kennelId', (req: any, res: any) => this.handlePublicPost(req, res));
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
        const kennelRun = new KennelRun(
            config,
            this.deps.baseDogsMap,
            this.createSerializedDogFactory(),
            query || {},
            body,
            kennelVmGlobalsSuppliers
        );
        const season = await kennelRun.run();
        await this.persistNewMimics(config, season.exhausted);
        return convertSeasonToWaves(season);
    }

    // --- Private internals ---

    private createSerializedDogFactory() {
        const { nodesStore } = this.deps;
        return async (ids: string[]): Promise<Array<SerializedDog<unknown>>> => {
            const [serialized, mimics] = await Promise.all([
                nodesStore.findLatestVersionsByType(SerializedDog.name, ids),
                nodesStore.findLatestVersionsByType(MimicDog.name, ids),
            ]);
            return [...serialized, ...mimics].map((sd: any) => {
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
        const newLineageIds: string[] = [];

        for (const dog of exhausted) {
            if (!(dog instanceof MimicDog)) continue;
            const mimic = dog as MimicDog<unknown>;
            if (mimic.instanceConfig?.lineageId) continue;

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

            newLineageIds.push(lineageId);
            console.log(`[KennelRunHandler] Persisted new mimic '${cfg.displayName}' (lineageId: ${lineageId})`);
        }

        if (newLineageIds.length > 0) {
            const updatedDogIds = [...(config.dogIds ?? []), ...newLineageIds];
            await this.deps.kennelsController.heal(config.id, {
                dogIds: updatedDogIds,
            } as any);
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

    private sendResult(res: any, result: any) {
        if (typeof result === 'string' && (
            result.trim().startsWith('<html') ||
            result.trim().startsWith('<!DOCTYPE') ||
            (result.trim().startsWith('<') && result.includes('</'))
        )) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
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
            this.sendResult(res, firstDog.result);
        } catch (err) {
            console.error('[KennelRunHandler.handleExecute]', err);
            res.status(500).json({ error: String(err) });
        }
    }

    private async handlePublicGet(req: any, res: any): Promise<void> {
        const kennelId = req.params.kennelId;
        if (kennelId === 'api' || kennelId === 'kennel' || kennelId === 'edit') return;

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
            const waves = await this.runKennel(config, queryData, undefined);
            const firstDog = this.findDogInWaves(waves, dogIds[0]);
            if (!firstDog) {
                res.status(404).json({ error: `Hund ${dogIds[0]} nicht in den Waves gefunden` });
                return;
            }
            this.sendResult(res, firstDog.result);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: String(err) });
        }
    }

    private async handlePublicPost(req: any, res: any): Promise<void> {
        const kennelId = req.params.kennelId;
        if (kennelId === 'api' || kennelId === 'kennel' || kennelId === 'edit') return;

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
            this.sendResult(res, firstDog.result);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: String(err) });
        }
    }
}
