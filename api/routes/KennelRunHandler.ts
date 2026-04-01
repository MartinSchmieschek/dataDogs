// The KennelRunHandler — the ship's boatswain who unleashes the hounds upon the data seas.
// When a kennel runs, the dogs are roused from their kennels and sent to hunt.
// Roiling, moaning, this realm of ours: waves crash as each dog delivers its plunder.
import { SerializedDog, MimicDog, type IMimicDogConfig, IKennelConfig, KennelRun } from '@datadogs/core';
import { IStore } from '../../store/IStore';
import { KennelController } from '../KennelController';
import { convertSeasonToWaves, Waves } from '../../services/WavesConverter';
import { kennelVmGlobalsSuppliers } from '../../services/kennelVmGlobals';
import { SwaggerGenerator } from '../../services/SwaggerGenerator';
import { generateVersionId, generateLineageId } from '../utils/versioning';

/** The provisions required to arm the KennelRunHandler for its voyage. */
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

    /** Raise all kennel-run sails — register every route for running, executing, and documenting kennels. */
    registerRoutes(app: any): void {
        // Swagger scrolls — a map of the kennel's hunt, rendered as OpenAPI for any who seek it.
        app.get('/api/kennels/:id/swagger.json', (req: any, res: any) => this.handleSwaggerJson(req, res));
        app.get('/api/kennels/:id/docs', (req: any, res: any) => this.handleSwaggerUi(req, res));

        // The run routes — unleash the full pack and return all waves of plunder.
        app.get('/api/kennels/:id/run', (req: any, res: any) => this.handleRun(req, res));
        app.post('/api/kennels/:id/run', (req: any, res: any) => this.handleRun(req, res));
        // The execute routes — run the pack and return only the lead dog's bounty.
        app.get('/api/kennels/:id/execute', (req: any, res: any) => this.handleExecute(req, res));
        app.post('/api/kennels/:id/execute', (req: any, res: any) => this.handleExecute(req, res));

        // The public endpoints — what the world sees when it calls our ship by kennel name.
        app.get('/:kennelId', (req: any, res: any) => this.handlePublicGet(req, res));
        app.post('/:kennelId', (req: any, res: any) => this.handlePublicPost(req, res));
    }

    /**
     * Fetch the kennel's config from the deep.
     * If a ?version= query param is present, loads that exact version.
     * Otherwise resolves by lineageId (latest version).
     */
    private async loadKennelConfig(id: string, versionOverride?: string): Promise<IKennelConfig | null> {
        const lookupId = versionOverride || id;
        const result = await this.deps.kennelsController.getById(lookupId);
        return (result.ok && result.data) ? result.data : null;
    }

    /**
     * Builds the factory that summons SerializedDogs from the store.
     * A SerializedDog that imitates another becomes a MimicDog — wearing a borrowed form.
     * Through endless faces, countless forms, a multitude unfolds.
     */
    private createSerializedDogFactory() {
        const { nodesStore } = this.deps;
        return async (ids: string[]): Promise<Array<SerializedDog<unknown>>> => {
            // Load both SerializedDogs and MimicDogs — they sail under different type brands.
            const [serialized, mimics] = await Promise.all([
                nodesStore.findLatestVersionsByType(SerializedDog.name, ids),
                nodesStore.findLatestVersionsByType(MimicDog.name, ids),
            ]);
            const loaded = [...serialized, ...mimics];
            return loaded.map((sd: any) => {
                const config = typeof sd.serializedDogConfig === 'string'
                    ? JSON.parse(sd.serializedDogConfig)
                    : sd.serializedDogConfig;
                const imitates = (config as IMimicDogConfig).imitates;
                // If the dog imitates another, it dons the MimicDog disguise.
                if (typeof imitates === 'string' && imitates.length > 0) {
                    return new MimicDog(config as IMimicDogConfig, sd.id);
                }
                return new SerializedDog(config, sd.id);
            });
        };
    }

    /**
     * Unleash the kennel — run every hound and collect the waves of plunder.
     * The hunt is conducted by KennelRun; the season is converted to Waves by the WavesConverter.
     * Carrion hordes trill their profane accord: each dog takes what it can from the data sea.
     */
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
            body,
            kennelVmGlobalsSuppliers
        );
        const season = await kennelRun.run();

        // Persist any fresh auto-mimics to the deep — as new entities with their own lineageId.
        // Once persisted, their lineageId is added to the kennel so next run loads them via the factory.
        await this.persistNewMimics(config, season.exhausted);

        return convertSeasonToWaves(season);
    }

    /**
     * Find mimics that were conjured fresh (no lineageId yet) and persist them to the store.
     * Their lineageId is then added to the kennel config so future runs load them normally.
     */
    private async persistNewMimics(config: IKennelConfig, exhausted: any[]): Promise<void> {
        const { nodesStore } = this.deps;
        const newLineageIds: string[] = [];

        for (const dog of exhausted) {
            if (!(dog instanceof MimicDog)) continue;
            const mimic = dog as MimicDog<unknown>;
            // If the mimic already has a lineageId in its config, it was loaded from the DB — skip it.
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

            // Update the in-memory mimic so the WavesConverter picks up the lineageId.
            mimic.instanceConfig.id = versionId;
            mimic.instanceConfig.lineageId = lineageId;
            mimic.instanceConfig.parentId = null;
            mimic.instanceConfig.displayName = cfg.displayName;

            newLineageIds.push(lineageId);
            console.log(`[KennelRunHandler] Persisted new mimic '${cfg.displayName}' (lineageId: ${lineageId})`);
        }

        // Add the new mimic lineageId values to the kennel's dogIds so next run finds them.
        if (newLineageIds.length > 0) {
            const updatedDogIds = [...(config.dogIds ?? []), ...newLineageIds];
            await this.deps.kennelsController.save({
                id: config.id,
                dogIds: updatedDogIds,
            } as any);
        }
    }

    /**
     * Merges default query params with request query params.
     * Request params override defaults — the caller's voice drowns out the kennel's whisper.
     * All keys are lowercased, for the void is not case-sensitive.
     */
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

    /**
     * Hunts through all waves to find a specific dog by its ID.
     * Matches by exact version ID, lineageId (lineage GUID), or name — the hound answers to many marks.
     * In luminous space, blackened stars gaze: if the dog is not found, null is returned.
     */
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

    /**
     * Sends the result to the caller — HTML if the plunder looks like HTML, JSON otherwise.
     * The deep does not care for format; we detect and serve what it has yielded.
     */
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
     * GET /api/kennels/:id/swagger.json
     * Runs the kennel and forges the OpenAPI spec from the plunder.
     * Its heralds are the stars it fells: the spec documents what the hounds have gathered.
     */
    private async handleSwaggerJson(req: any, res: any): Promise<void> {
        try {
            const config = await this.loadKennelConfig(req.params.id);
            if (!config) {
                res.status(404).json({ error: `Kennel ${req.params.id} nicht gefunden` });
                return;
            }

            const query = this.mergeQueryParams(config.defaultQuery, req.query);
            const body = config.defaultBody;
            const waves = await this.runKennel(config, query, body);

            const spec = SwaggerGenerator.generate(config, waves);
            res.json(spec);
        } catch (err) {
            console.error('[KennelRunHandler.handleSwaggerJson]', err);
            res.status(500).json({ error: String(err) });
        }
    }

    /**
     * GET /api/kennels/:id/docs
     * Runs the kennel and renders the Swagger UI — a map of the hunt for all to read.
     * The sky and earth aflame with documentation, illuminated by the OpenAPI spec.
     */
    private async handleSwaggerUi(req: any, res: any): Promise<void> {
        try {
            const config = await this.loadKennelConfig(req.params.id);
            if (!config) {
                res.status(404).json({ error: `Kennel ${req.params.id} nicht gefunden` });
                return;
            }
            const title = config.name || config.id;
            const specUrl = `/api/kennels/${config.id}/swagger.json`;
            const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title} — API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "${specUrl}",
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout",
      deepLinking: true,
    });
  </script>
</body>
</html>`;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(html);
        } catch (err) {
            console.error('[KennelRunHandler.handleSwaggerUi]', err);
            res.status(500).json({ error: String(err) });
        }
    }

    /**
     * GET/POST /api/kennels/:id/run
     * Unleashes the full pack and returns all waves + the kennel config.
     * Used by the Angular frontend to chart the hunt's full course.
     * For POST: the caller's body is taken as-is — even an empty {} is honoured.
     * "Nothing to harvest" is a known fate — returned as a soft error, not a shipwreck.
     */
    private async handleRun(req: any, res: any): Promise<void> {
        try {
            const config = await this.loadKennelConfig(req.params.id, req.query.version);
            if (!config) {
                res.status(404).json({ ok: false, error: `Kennel ${req.params.id} nicht gefunden` });
                return;
            }

            const query = this.mergeQueryParams(config.defaultQuery, req.query);
            // POST gives us the caller's body directly — defaultBody is only for GET or bodyless requests.
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
                    // The void was empty — no plunder found, but the ship still sails.
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

    /**
     * GET/POST /api/kennels/:id/execute
     * Runs the pack and returns only the lead dog's plunder — the first dog in the config.
     * A kennel with no dogs cannot hunt — the request is denied with a 400.
     */
    private async handleExecute(req: any, res: any): Promise<void> {
        try {
            const config = await this.loadKennelConfig(req.params.id, req.query.version);
            if (!config) {
                res.status(404).json({ error: `Kennel ${req.params.id} nicht gefunden` });
                return;
            }

            const dogIds = config.dogIds || [];
            if (dogIds.length === 0) {
                // A kennel without hounds cannot hunt — send them back empty-handed.
                res.status(400).json({ error: 'Keine Hunde in der Config gefunden' });
                return;
            }

            const queryData = this.mergeQueryParams(config.defaultQuery, req.query);

            const body =
                req.method === 'POST' && req.body !== undefined && req.body !== null
                    ? req.body
                    : config.defaultBody;
            const waves = await this.runKennel(config, queryData, body);

            // The lead dog carries the bounty — all others served only to support.
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
     * GET /:kennelId — The public production endpoint; the face we show to the world.
     * Reserved words ('api', 'kennel', 'edit') pass by without challenge — they serve other ports.
     * The sky and earth aflame: when the outside world calls, only the lead dog answers.
     */
    private async handlePublicGet(req: any, res: any): Promise<void> {
        const kennelId = req.params.kennelId;
        // Let the reserved ports sail past — they serve other masters.
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
     * POST /:kennelId — The public production endpoint with a body.
     * Same rules as the GET variant, but the caller may carry cargo in the body.
     * If no body is given, the kennel's defaultBody is used as ballast.
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

            // Use the caller's body if it carries one; fall back to the kennel's default cargo.
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
