// The KennelBundleHandler — Khra's vessel, carrying a kennel's soul across the void.
// To cosmic forms from tangent planes, we end as we began.
import { SerializedDog, MimicDog, type IMimicDogConfig } from '@datadogs/core';
import { KennelController } from '../KennelController';
import { IStore } from '../../store/IStore';
import { generateVersionId, generateLineageId } from '../utils/versioning';
import { KennelRunHandler } from './KennelRunHandler';

/**
 * Handles kennel export and import — the rites of passage across systems.
 */
export class KennelBundleHandler {
    constructor(
        private runHandler: KennelRunHandler,
        private kennelsController: KennelController,
        private nodesStore: IStore,
    ) {}

    registerRoutes(app: any): void {
        app.get('/api/kennels/:id/export', (req: any, res: any) => this.handleExport(req, res));
        app.post('/api/kennels/import', (req: any, res: any) => this.handleImport(req, res));
    }

    /**
     * GET /api/kennels/:id/export
     * Exports a kennel and all its serialized dogs as a portable bundle.
     * IDs are preserved as-is — remapping happens on import, not here.
     */
    private async handleExport(req: any, res: any): Promise<void> {
        try {
            const config = await this.runHandler.loadKennelConfig(req.params.id, req.query.version);
            if (!config) {
                res.status(404).json({ error: `Kennel ${req.params.id} nicht gefunden` });
                return;
            }

            const dogs: any[] = [];

            // Collect all non-base dog references from the kennel.
            const serializedIds = (config.dogIds ?? []).filter(id => !id.startsWith('base:'));

            if (serializedIds.length > 0) {
                const [serialized, mimics] = await Promise.all([
                    this.nodesStore.findLatestVersionsByType(SerializedDog.name, serializedIds),
                    this.nodesStore.findLatestVersionsByType(MimicDog.name, serializedIds),
                ]);

                for (const row of [...serialized, ...mimics]) {
                    const cfg = typeof row.serializedDogConfig === 'string'
                        ? JSON.parse(row.serializedDogConfig)
                        : row.serializedDogConfig;
                    dogs.push({
                        lineageId: (row as any).lineageId || cfg.lineageId,
                        versionId: row.id,
                        displayName: (row as any).displayName || cfg.displayName,
                        type: cfg.imitates ? 'MimicDog' : 'SerializedDog',
                        config: cfg,
                    });
                }
            }

            // Load kennel version history.
            const kennelLineageId = (config as any).lineageId || req.params.id;
            const kennelVersions = await this.kennelsController.getVersions(kennelLineageId);

            const bundle = {
                bundleVersion: 1,
                kennel: {
                    kennelId: kennelLineageId,
                    name: config.name,
                    description: config.description,
                    emoji: config.emoji,
                    dogIds: config.dogIds,
                    defaultQuery: config.defaultQuery,
                    defaultBody: config.defaultBody,
                },
                kennelVersions: kennelVersions.map(v => ({
                    id: v.id,
                    parentId: v.parentId,
                    createdAt: v.createdAt,
                    config: v.config,
                })),
                dogs,
            };

            res.json(bundle);
        } catch (err) {
            console.error('[KennelBundleHandler.handleExport]', err);
            res.status(500).json({ error: String(err) });
        }
    }

    /**
     * POST /api/kennels/import
     * Imports a kennel bundle — all IDs are regenerated, references remapped.
     * If kennelId already exists, a copy is created with a suffixed ID and name.
     */
    private async handleImport(req: any, res: any): Promise<void> {
        try {
            const bundle = req.body;
            if (!bundle?.kennel || !Array.isArray(bundle.dogs)) {
                res.status(400).json({ error: 'Invalid bundle: kennel and dogs[] required' });
                return;
            }

            // Resolve kennel ID — if it already exists, find a free one.
            let kennelId = bundle.kennel.kennelId;
            let kennelName = bundle.kennel.name || kennelId;
            const originalId = kennelId;
            let copyIndex = 0;
            while (true) {
                const existing = await this.kennelsController.getById(kennelId);
                if (!existing.ok || !existing.data) break;
                copyIndex++;
                kennelId = `${originalId}-copy${copyIndex > 1 ? '-' + copyIndex : ''}`;
                kennelName = `${bundle.kennel.name || originalId} (Kopie${copyIndex > 1 ? ' ' + copyIndex : ''})`;
            }

            // Build ID mapping: old lineageId/versionId → new lineageId.
            const idMap = new Map<string, string>();
            for (const dog of bundle.dogs) {
                const newLineageId = generateLineageId();
                if (dog.lineageId) idMap.set(dog.lineageId, newLineageId);
                if (dog.versionId) idMap.set(dog.versionId, newLineageId);
            }

            const remap = (ref: string): string => idMap.get(ref) ?? ref;

            // Create all dogs with new IDs.
            for (const dog of bundle.dogs) {
                const newLineageId = idMap.get(dog.lineageId) || generateLineageId();
                const newVersionId = generateVersionId();

                const cfg = { ...dog.config };
                cfg.id = newVersionId;
                cfg.lineageId = newLineageId;
                cfg.parentId = null;
                cfg.displayName = dog.displayName || cfg.displayName;

                if (Array.isArray(cfg.parentsRequired)) {
                    cfg.parentsRequired = cfg.parentsRequired.map(remap);
                }
                if (Array.isArray(cfg.parentsOptional)) {
                    cfg.parentsOptional = cfg.parentsOptional.map(remap);
                }

                const type = cfg.imitates ? MimicDog.name : SerializedDog.name;

                await this.nodesStore.save({
                    id: newVersionId,
                    type,
                    lineageId: newLineageId,
                    parentId: null,
                    displayName: cfg.displayName,
                    serializedDogConfig: JSON.stringify(cfg),
                    createdAt: new Date(),
                });
            }

            // Remap kennel dogIds.
            const remapDogIds = (ids: string[]) => (ids ?? []).map(remap);

            // Restore kennel versions if present, otherwise create a single version.
            const versions = Array.isArray(bundle.kennelVersions) && bundle.kennelVersions.length > 0
                ? bundle.kennelVersions
                : null;

            if (versions) {
                // Sort oldest first so parentId chain is preserved.
                const sorted = [...versions].sort((a: any, b: any) => {
                    const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return aT - bT;
                });

                const versionIdMap = new Map<string, string>();
                for (const v of sorted) {
                    versionIdMap.set(v.id, generateVersionId());
                }

                for (let vi = 0; vi < sorted.length; vi++) {
                    const v = sorted[vi];
                    const isLast = vi === sorted.length - 1;
                    const newVersionId = versionIdMap.get(v.id)!;
                    const oldParentId = v.parentId;
                    const newParentId = oldParentId ? (versionIdMap.get(oldParentId) ?? null) : null;
                    const vCfg = v.config || bundle.kennel;

                    await this.nodesStore.save({
                        id: newVersionId,
                        type: 'KennelConfig',
                        lineageId: kennelId,
                        parentId: newParentId,
                        name: isLast ? kennelName : vCfg.name,
                        description: vCfg.description,
                        emoji: vCfg.emoji,
                        dogIds: remapDogIds(vCfg.dogIds),
                        defaultQuery: vCfg.defaultQuery ? JSON.stringify(vCfg.defaultQuery) : undefined,
                        defaultBody: vCfg.defaultBody ? JSON.stringify(vCfg.defaultBody) : undefined,
                        createdAt: v.createdAt ? new Date(v.createdAt).toISOString() : new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    });
                }
            } else {
                const createResult = await this.kennelsController.create({
                    id: kennelId,
                    name: kennelName,
                    description: bundle.kennel.description,
                    emoji: bundle.kennel.emoji,
                    dogIds: remapDogIds(bundle.kennel.dogIds),
                });

                if (!createResult.ok) {
                    res.status(500).json({ error: createResult.error });
                    return;
                }

                if (bundle.kennel.defaultQuery || bundle.kennel.defaultBody) {
                    await this.kennelsController.heal(kennelId, {
                        defaultQuery: bundle.kennel.defaultQuery,
                        defaultBody: bundle.kennel.defaultBody,
                    } as any);
                }
            }

            res.json({
                ok: true,
                kennelId,
                idMap: Object.fromEntries(idMap),
            });
        } catch (err) {
            console.error('[KennelBundleHandler.handleImport]', err);
            res.status(500).json({ error: String(err) });
        }
    }
}
