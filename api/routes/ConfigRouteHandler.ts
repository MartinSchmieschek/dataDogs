import { Request, Response } from 'express';
import { AbstractController, IControllerResponse, IEntity } from '../AbstractController';

/**
 * Registry für Controller, die über Subpaths erreichbar sind
 */
export class ControllerRegistry {
    private controllers: Map<string, AbstractController<any>> = new Map();

    /**
     * Registriert einen Controller für einen Subpath
     * @param subpath - Der Subpath (z.B. 'nodes', 'kennels')
     * @param controller - Der Controller
     */
    register<T extends IEntity = IEntity>(subpath: string, controller: AbstractController<T>): void {
        this.controllers.set(subpath, controller as AbstractController<any>);
        console.log(`[ControllerRegistry] Controller für Subpath '${subpath}' registriert`);
    }

    /**
     * Gibt den Controller für einen Subpath zurück
     */
    get(subpath: string): AbstractController<any> | undefined {
        return this.controllers.get(subpath);
    }

    /**
     * Gibt alle registrierten Subpaths zurück
     */
    getSubpaths(): string[] {
        return Array.from(this.controllers.keys());
    }
}

/**
 * Generischer Route-Handler für Config-Operationen
 * Unterstützt CRUD-Operationen über Subpaths
 */
export class ConfigRouteHandler {
    private registry: ControllerRegistry;

    constructor(registry: ControllerRegistry) {
        this.registry = registry;
    }

    /**
     * Registriert alle Routes für einen Express-App
     * @param app - Express App
     * @param basePath - Basis-Pfad (z.B. '/api')
     */
    registerRoutes(app: any, basePath: string = '/api'): void {
        // GET /api/:subpath - Liste aller Configs
        app.get(`${basePath}/:subpath`, async (req: Request, res: Response) => {
            await this.handleList(req, res);
        });

        // GET /api/:subpath/:id - Einzelne Config laden
        app.get(`${basePath}/:subpath/:id`, async (req: Request, res: Response) => {
            await this.handleGetById(req, res);
        });

        // POST /api/:subpath - Neue Config erstellen
        app.post(`${basePath}/:subpath`, async (req: Request, res: Response) => {
            await this.handleCreate(req, res);
        });

        // POST /save - Speichern (Legacy-Kompatibilität für Nodes)
        app.post('/save', async (req: Request, res: Response) => {
            await this.handleSave(req, res);
        });

        // PUT /api/:subpath/:id - Config aktualisieren
        app.put(`${basePath}/:subpath/:id`, async (req: Request, res: Response) => {
            await this.handleUpdate(req, res);
        });

        // DELETE /api/:subpath/:id - Config löschen
        app.delete(`${basePath}/:subpath/:id`, async (req: Request, res: Response) => {
            await this.handleDelete(req, res);
        });

        console.log(`[ConfigRouteHandler] Routes registriert unter ${basePath}/:subpath`);
    }

    /**
     * Handler für GET /api/:subpath (Liste)
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
     * Handler für GET /api/:subpath/:id (Einzelne Config)
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
     * Handler für POST /api/:subpath (Erstellen)
     */
    private async handleCreate(req: Request, res: Response): Promise<void> {
        try {
            const subpath = req.params.subpath;
            const controller = this.registry.get(subpath);

            if (!controller) {
                res.status(404).json({ error: `Controller für Subpath '${subpath}' nicht gefunden` });
                return;
            }

            // Spezielle Behandlung für Nodes: Konvertiere baseId/tsCode zu id/theRun
            let input = req.body;
            if (subpath === 'nodes') {
                const baseId = input.baseId || `node-${Date.now()}`;
                const tsCode = input.tsCode || input.theRun || '';
                
                // Konvertiere zu ISerializedDogConfig Format
                input = {
                    id: baseId,  // Controller fügt automatisch -v1 hinzu
                    theRun: tsCode,  // Konvertiere tsCode zu theRun
                    parentsRequired: input.parentsRequired || [],
                    parentsOptional: input.parentsOptional || [],
                    version: 1
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
     * Handler für POST /save (Speichern - Legacy für Nodes mit Versionsverwaltung)
     * Konvertiert tsCode/code zu theRun für ISerializedDogConfig
     */
    private async handleSave(req: Request, res: Response): Promise<void> {
        try {
            // Legacy: /save ist für Nodes mit Versionsverwaltung
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

            // Konvertiere zu ISerializedDogConfig Format (tsCode -> theRun)
            // Merge mit vorhandener Config, falls vorhanden
            const existingConfig = req.body.serializedDogConfig || {};
            const input = {
                id,
                theRun: tsCode,  // Konvertiere tsCode zu theRun
                parentsRequired: req.body.parentsRequired !== undefined ? req.body.parentsRequired : (existingConfig.parentsRequired || []),
                parentsOptional: req.body.parentsOptional !== undefined ? req.body.parentsOptional : (existingConfig.parentsOptional || []),
                ...existingConfig  // Merge mit vorhandener Config (theRun wird überschrieben)
            };

            // Controller hat jetzt automatische Versionsverwaltung
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
     * Handler für PUT /api/:subpath/:id (Aktualisieren)
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
     * Handler für DELETE /api/:subpath/:id (Löschen)
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
}

