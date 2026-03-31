// The ConfigRouteHandler — the ship's navigator, mapping all HTTP requests to their captains.
// In luminous space, blackened stars: each subpath is a star, each controller its light.
import { Request, Response } from 'express';
import { AbstractController, IControllerResponse, IEntity } from '../AbstractController';

/**
 * The ControllerRegistry — a chart of all captains aboard, indexed by subpath.
 * Each subpath is a port; each controller, the harbourmaster who answers there.
 * Roiling, moaning, this realm of ours: without the registry, no request finds its captain.
 */
export class ControllerRegistry {
    private controllers: Map<string, AbstractController<any>> = new Map();

    /**
     * Register a captain for a given port (subpath).
     * @param subpath - The port name (e.g. 'nodes', 'kennels').
     * @param controller - The captain who shall answer at that port.
     */
    register<T extends IEntity = IEntity>(subpath: string, controller: AbstractController<T>): void {
        this.controllers.set(subpath, controller as AbstractController<any>);
        console.log(`[ControllerRegistry] Controller für Subpath '${subpath}' registriert`);
    }

    /**
     * Retrieve the captain for a given port — null if no one answers.
     */
    get(subpath: string): AbstractController<any> | undefined {
        return this.controllers.get(subpath);
    }

    /**
     * List all known ports — every subpath that has a captain aboard.
     */
    getSubpaths(): string[] {
        return Array.from(this.controllers.keys());
    }
}

/**
 * The ConfigRouteHandler — binds HTTP routes to controller captains.
 * It supports the full CRUD armada across any registered subpath.
 * Its heralds are the stars it fells: each route is a star in the eldritch sky.
 */
export class ConfigRouteHandler {
    private registry: ControllerRegistry;

    constructor(registry: ControllerRegistry) {
        this.registry = registry;
    }

    /**
     * Raise all sails — register every CRUD route onto the Express ship.
     * @param app - The Express vessel.
     * @param basePath - The base port from which all routes depart (default: '/api').
     */
    registerRoutes(app: any, basePath: string = '/api'): void {
        // GET /api/:subpath/:id/versions — summon every past life of an entity, newest first.
        app.get(`${basePath}/:subpath/:id/versions`, async (req: Request, res: Response) => {
            await this.handleGetVersions(req, res);
        });

        // GET /api/:subpath — haul up the full manifest of entities at this port.
        app.get(`${basePath}/:subpath`, async (req: Request, res: Response) => {
            await this.handleList(req, res);
        });

        // GET /api/:subpath/:id — dredge a single entity from the deep by name.
        app.get(`${basePath}/:subpath/:id`, async (req: Request, res: Response) => {
            await this.handleGetById(req, res);
        });

        // POST /api/:subpath — birth a new entity into the void.
        app.post(`${basePath}/:subpath`, async (req: Request, res: Response) => {
            await this.handleCreate(req, res);
        });

        // POST /save — the old way, kept alive for Node versioning.
        // In madness lost shall die? Nay, this legacy route yet sails on.
        app.post('/save', async (req: Request, res: Response) => {
            await this.handleSave(req, res);
        });

        // PUT /api/:subpath/:id — update an entity; the new version swallows the old.
        app.put(`${basePath}/:subpath/:id`, async (req: Request, res: Response) => {
            await this.handleUpdate(req, res);
        });

        // DELETE /api/:subpath/:id — cast the entity into the void, never to return.
        app.delete(`${basePath}/:subpath/:id`, async (req: Request, res: Response) => {
            await this.handleDelete(req, res);
        });

        console.log(`[ConfigRouteHandler] Routes registriert unter ${basePath}/:subpath`);
    }

    /**
     * Handles GET /api/:subpath — hauls up the full manifest of entities at this port.
     * If no captain answers at this subpath, the void returns a 404.
     */
    private async handleList(req: Request, res: Response): Promise<void> {
        try {
            const subpath = req.params.subpath;
            const controller = this.registry.get(subpath);

            if (!controller) {
                res.status(404).json({ error: `Controller für Subpath '${subpath}' nicht gefunden` });
                return;
            }

            const result = await controller.list();
            if (result.ok) {
                res.status(200).json({ ok: true, data: result.data });
            } else {
                res.status(500).json({ error: result.error });
            }
        } catch (e) {
            console.error(`[ConfigRouteHandler.handleList] Fehler:`, e);
            res.status(500).json({ error: String(e) });
        }
    }

    /**
     * Handles GET /api/:subpath/:id — dredges a single named entity from the deep.
     * Returns 404 if both captain and entity are swallowed by the void.
     */
    private async handleGetById(req: Request, res: Response): Promise<void> {
        try {
            const subpath = req.params.subpath;
            const id = req.params.id;
            const controller = this.registry.get(subpath);

            if (!controller) {
                res.status(404).json({ error: `Controller für Subpath '${subpath}' nicht gefunden` });
                return;
            }

            const result = await controller.getById(id);
            if (result.ok) {
                res.status(200).json({ ok: true, data: result.data });
            } else {
                res.status(404).json({ error: result.error });
            }
        } catch (e) {
            console.error(`[ConfigRouteHandler.handleGetById] Fehler:`, e);
            res.status(500).json({ error: String(e) });
        }
    }

    /**
     * Handles POST /api/:subpath — births a new entity into the eldritch store.
     * For Nodes, the cargo is translated: baseId/tsCode become id/theRun before creation.
     * Corporeal laws are unwritten: we reformat what the caller sends to fit the deep.
     */
    private async handleCreate(req: Request, res: Response): Promise<void> {
        try {
            const subpath = req.params.subpath;
            const controller = this.registry.get(subpath);

            if (!controller) {
                res.status(404).json({ error: `Controller für Subpath '${subpath}' nicht gefunden` });
                return;
            }

            // Node creation requires special translation — the caller speaks in tsCode; the store speaks in theRun.
            let input = req.body;
            if (subpath === 'nodes') {
                const baseId = input.baseId || `node-${Date.now()}`;
                const tsCode = input.tsCode || input.theRun || '';

                // Repack into ISerializedDogConfig format — the controller will brand it with -v1.
                input = {
                    id: baseId,
                    theRun: tsCode,
                    parentsRequired: input.parentsRequired || [],
                    parentsOptional: input.parentsOptional || [],
                    version: 1,
                    ...(typeof req.body.icon === 'string' ? { icon: req.body.icon } : {}),
                };
            }

            const result = await controller.create(input);
            if (result.ok) {
                res.status(200).json({ ok: true, id: result.id, data: result.data });
            } else {
                res.status(500).json({ error: result.error });
            }
        } catch (e) {
            console.error(`[ConfigRouteHandler.handleCreate] Fehler:`, e);
            res.status(500).json({ error: String(e) });
        }
    }

    /**
     * Handles POST /save — the legacy route for saving Nodes with automatic version advancement.
     * Translates tsCode/code to theRun before passing to the Node controller.
     * It gaze, accuse, deny: the deep demands an id and tsCode or it refuses the cargo.
     */
    private async handleSave(req: Request, res: Response): Promise<void> {
        try {
            // Legacy: /save is bound to the nodes captain only.
            const controller = this.registry.get('nodes');
            if (!controller) {
                res.status(404).json({ error: 'Node-Controller nicht gefunden' });
                return;
            }

            const id = req.query.id || req.body.id;
            const tsCode = req.body.tsCode || req.body.code;

            if (!id || !tsCode) {
                res.status(400).json({ error: 'id and tsCode are required' });
                return;
            }

            const existingConfig = req.body.serializedDogConfig || {};
            const input = {
                ...existingConfig,
                id,
                theRun: tsCode,
                parentsRequired: req.body.parentsRequired ?? existingConfig.parentsRequired ?? [],
                parentsOptional: req.body.parentsOptional ?? existingConfig.parentsOptional ?? [],
                ...(req.body.icon !== undefined
                    ? { icon: req.body.icon === '' ? undefined : req.body.icon }
                    : {}),
            };

            // The controller handles versioning — a new version is automatically stamped.
            const result = await controller.save(input);
            if (result.ok) {
                res.status(200).json({ ok: true, id: result.id });
            } else {
                res.status(400).json({ error: result.error });
            }
        } catch (e) {
            console.error(`[ConfigRouteHandler.handleSave] Fehler:`, e);
            res.status(500).json({ error: String(e) });
        }
    }

    /**
     * Handles PUT /api/:subpath/:id — updates an entity in place, spawning a new version.
     * The id from the URL overrides any id in the body — the path speaks louder.
     */
    private async handleUpdate(req: Request, res: Response): Promise<void> {
        try {
            const subpath = req.params.subpath;
            const id = req.params.id;
            const controller = this.registry.get(subpath);

            if (!controller) {
                res.status(404).json({ error: `Controller für Subpath '${subpath}' nicht gefunden` });
                return;
            }

            const result = await controller.save({ ...req.body, id });
            if (result.ok) {
                res.status(200).json({ ok: true, id: result.id, data: result.data });
            } else {
                res.status(400).json({ error: result.error });
            }
        } catch (e) {
            console.error(`[ConfigRouteHandler.handleUpdate] Fehler:`, e);
            res.status(500).json({ error: String(e) });
        }
    }

    /**
     * Handles DELETE /api/:subpath/:id — casts the entity overboard.
     * Once consigned to the void, it shall not return.
     */
    private async handleDelete(req: Request, res: Response): Promise<void> {
        try {
            const subpath = req.params.subpath;
            const id = req.params.id;
            const controller = this.registry.get(subpath);

            if (!controller) {
                res.status(404).json({ error: `Controller für Subpath '${subpath}' nicht gefunden` });
                return;
            }

            const result = await controller.delete(id);
            if (result.ok) {
                res.status(200).json({ ok: true });
            } else {
                res.status(400).json({ error: result.error });
            }
        } catch (e) {
            console.error(`[ConfigRouteHandler.handleDelete] Fehler:`, e);
            res.status(500).json({ error: String(e) });
        }
    }

    /**
     * Handles GET /api/:subpath/:id/versions — summons all past lives of an entity, newest first.
     * The -v\d+ suffix is stripped to find the base name; all versions of that lineage are returned.
     * To cosmic forms from tangent planes we end as we began: all versions preserved.
     */
    private async handleGetVersions(req: Request, res: Response): Promise<void> {
        try {
            const subpath = req.params.subpath;
            const id = req.params.id;
            const controller = this.registry.get(subpath);

            if (!controller) {
                res.status(404).json({ error: `Controller für Subpath '${subpath}' nicht gefunden` });
                return;
            }

            const baseId = id.replace(/-v\d+$/, '');
            const versions = await controller.getVersions(baseId);
            res.status(200).json({ ok: true, data: versions });
        } catch (e) {
            console.error(`[ConfigRouteHandler.handleGetVersions] Fehler:`, e);
            res.status(500).json({ error: String(e) });
        }
    }
}

