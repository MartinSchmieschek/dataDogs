import { SerializedDog, IKennelConfig, KennelRun } from 'datadogs';
import { IStore } from '../../store/IStore';
import { KennelController } from '../KennelController';
import { convertSeasonToWaves, Waves } from '../../services/WavesConverter';

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

    registerRoutes(app: any): void {
        app.get('/api/kennels/:id/run', (req: any, res: any) => this.handleRun(req, res));
        app.post('/api/kennels/:id/run', (req: any, res: any) => this.handleRun(req, res));
        app.get('/api/kennels/:id/execute', (req: any, res: any) => this.handleExecute(req, res));
        app.post('/api/kennels/:id/execute', (req: any, res: any) => this.handleExecute(req, res));

        app.get('/:kennelId', (req: any, res: any) => this.handlePublicGet(req, res));
        app.post('/:kennelId', (req: any, res: any) => this.handlePublicPost(req, res));
    }

    private async loadKennelConfig(id: string): Promise<IKennelConfig | null> {
        const result = await this.deps.kennelsController.getById(id);
        return (result.ok && result.data) ? result.data : null;
    }

    private createSerializedDogFactory() {
        const { nodesStore } = this.deps;
        return async (ids: string[]): Promise<Array<SerializedDog<unknown>>> => {
            const loaded = await nodesStore.findLatestVersionsByType(SerializedDog.name, ids);
            return loaded.map((sd: any) => {
                const config = typeof sd.serializedDogConfig === 'string'
                    ? JSON.parse(sd.serializedDogConfig)
                    : sd.serializedDogConfig;
                return new SerializedDog(config, sd.id);
            });
        };
    }

    private async runKennel(
        config: IKennelConfig,
        query?: Record<string, string>,
        body?: any
    ): Promise<Waves> {
        const kennelRun = new KennelRun(
            config,
            this.deps.baseDogsMap,
            this.createSerializedDogFactory(),
            query || {},
            body
        );
        const season = await kennelRun.run();
        return convertSeasonToWaves(season);
    }

    private mergeQueryParams(defaults: Record<string, string> | undefined, reqQuery: Record<string, any>): Record<string, string> {
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

    private findDogInWaves(waves: Waves, targetDogId: string) {
        const searchId = targetDogId.startsWith('base:')
            ? targetDogId.substring(5)
            : targetDogId;

        for (const wave of waves) {
            for (const node of wave) {
                if (node.id === searchId ||
                    node.id === targetDogId ||
                    node.id.replace(/-v\d+$/, '') === searchId.replace(/-v\d+$/, '') ||
                    node.id.replace(/-v\d+$/, '') === targetDogId.replace(/-v\d+$/, '')) {
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

    /**
     * GET/POST /api/kennels/:id/run
     * Führt einen Kennel aus und gibt Waves + KennelConfig als JSON zurück.
     * Wird vom Angular-Frontend verwendet.
     */
    private async handleRun(req: any, res: any): Promise<void> {
        try {
            const config = await this.loadKennelConfig(req.params.id);
            if (!config) {
                res.status(404).json({ ok: false, error: `Kennel ${req.params.id} nicht gefunden` });
                return;
            }

            const rawDefaults = config.defaultQuery || {};
            const query: Record<string, string> = {};
            Object.entries(rawDefaults).forEach(([k, v]) => { query[k.toLowerCase()] = String(v).toLowerCase(); });
            const body = req.body && Object.keys(req.body).length > 0
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
                    throw runError;
                }
            }
        } catch (err) {
            console.error('[KennelRunHandler.handleRun]', err);
            res.status(500).json({ ok: false, error: String(err) });
        }
    }

    /**
     * GET/POST /api/kennels/:id/execute
     * Führt einen Kennel aus und gibt das Ergebnis des ersten Dogs zurück.
     */
    private async handleExecute(req: any, res: any): Promise<void> {
        try {
            const config = await this.loadKennelConfig(req.params.id);
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

            const body = req.body && Object.keys(req.body).length > 0 ? req.body : config.defaultBody;
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

    /**
     * GET /:kennelId  — Öffentlicher Produktions-Endpunkt
     */
    private async handlePublicGet(req: any, res: any): Promise<void> {
        const kennelId = req.params.kennelId;
        if (kennelId === 'api' || kennelId === 'kennel' || kennelId === 'edit') return;

        try {
            const config = await this.loadKennelConfig(kennelId);
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

    /**
     * POST /:kennelId  — Öffentlicher Produktions-Endpunkt mit Body
     */
    private async handlePublicPost(req: any, res: any): Promise<void> {
        const kennelId = req.params.kennelId;
        if (kennelId === 'api' || kennelId === 'kennel' || kennelId === 'edit') return;

        try {
            const config = await this.loadKennelConfig(kennelId);
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

            let bodyData = config.defaultBody;
            if (req.body && Object.keys(req.body).length > 0) {
                bodyData = req.body;
            }

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
