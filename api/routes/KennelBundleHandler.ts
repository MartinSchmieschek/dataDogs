// The KennelBundleHandler — Khra's vessel, carrying a kennel's soul across the void.
// To cosmic forms from tangent planes, we end as we began.
import {
    SerializedDog,
    MimicDog,
    kennelDisplayNameBlockedReason,
    kennelLineageIdBlockedReason,
} from '@datadogs/core';
import { KennelController } from '../KennelController';
import { IStore } from '../../store/IStore';
import { generateVersionId, generateLineageId } from '../utils/versioning';
import { KennelRunHandler } from './KennelRunHandler';
import { canRead } from '../../mcp/auth/visibility';

/**
 * Handles kennel export and import — the rites of passage across systems.
 *
 * Rules:
 *  - Export: keep `base:` refs as-is (runtime-provided), transitively collect
 *    every reachable SerializedDog/MimicDog via parentsRequired/parentsOptional,
 *    no history. Only the current stand travels.
 *  - Import: validate every `base:` ref against the local baseDogsMap (fail if
 *    missing), mint fresh lineage+version GUIDs for each serialized dog,
 *    remap parent refs accordingly. No history restore — a single fresh version.
 */
export class KennelBundleHandler {
    constructor(
        private runHandler: KennelRunHandler,
        private kennelsController: KennelController,
        private nodesStore: IStore,
        private baseDogsMap: Map<string, new () => any>,
    ) {}

    registerRoutes(app: any): void {
        app.get('/api/kennels/:id/export', (req: any, res: any) => this.handleExport(req, res));
        app.post('/api/kennels/import', (req: any, res: any) => this.handleImport(req, res));
    }

    private parseDogConfig(row: any): any {
        const raw = row?.serializedDogConfig;
        if (!raw) return {};
        if (typeof raw === 'string') {
            try { return JSON.parse(raw); } catch { return {}; }
        }
        return raw;
    }

    private collectRefs(cfg: any): string[] {
        const out: string[] = [];
        if (Array.isArray(cfg?.parentsRequired)) out.push(...cfg.parentsRequired);
        if (Array.isArray(cfg?.parentsOptional)) out.push(...cfg.parentsOptional);
        return out;
    }

    /**
     * GET /api/kennels/:id/export
     * Walks the kennel's serialized dogs transitively, collects every reachable
     * SerializedDog/MimicDog. `base:` refs travel as plain references.
     */
    private async handleExport(req: any, res: any): Promise<void> {
        try {
            const config = await this.runHandler.loadKennelConfig(req.params.id, req.query.version);
            if (!config) {
                res.status(404).json({ error: `Kennel ${req.params.id} nicht gefunden` });
                return;
            }
            if (!canRead(config as any, req.ctx)) {
                res.status(404).json({ error: `Kennel ${req.params.id} nicht gefunden` });
                return;
            }

            const seedIds = (config.dogIds ?? []).filter(id => !id.startsWith('base:'));
            const visited = new Set<string>();
            const collectedRows: any[] = [];
            const queue: string[] = [...seedIds];

            while (queue.length > 0) {
                const batch = queue.splice(0, queue.length).filter(id => !visited.has(id));
                if (batch.length === 0) continue;
                batch.forEach(id => visited.add(id));

                const [serialized, mimics] = await Promise.all([
                    this.nodesStore.findLatestVersionsByType(SerializedDog.name, batch),
                    this.nodesStore.findLatestVersionsByType(MimicDog.name, batch),
                ]);

                for (const row of [...serialized, ...mimics]) {
                    const cfg = this.parseDogConfig(row);
                    collectedRows.push({ row, cfg });
                    for (const ref of this.collectRefs(cfg)) {
                        if (typeof ref !== 'string') continue;
                        if (ref.startsWith('base:')) continue;
                        if (!visited.has(ref)) queue.push(ref);
                    }
                }
            }

            const dogs = collectedRows.map(({ row, cfg }) => ({
                lineageId: row.lineageId || cfg.lineageId,
                versionId: row.id,
                displayName: row.displayName || cfg.displayName,
                type: cfg.imitates ? 'MimicDog' : 'SerializedDog',
                config: cfg,
            }));

            const bundle = {
                bundleVersion: 2,
                kennel: {
                    kennelId: (config as any).lineageId || req.params.id,
                    name: config.name,
                    description: config.description,
                    emoji: config.emoji,
                    dogIds: config.dogIds,
                    defaultQuery: config.defaultQuery,
                    defaultBody: config.defaultBody,
                    task: config.task,
                    nodes: config.nodes,
                    edges: config.edges,
                },
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
     * Bundle rules:
     *  - `base:` refs must resolve against baseDogsMap, else 400.
     *  - SerializedDogs get fresh lineage+version GUIDs; parent refs are remapped.
     *  - Kennel is created as a single fresh version — no history restore.
     */
    private async handleImport(req: any, res: any): Promise<void> {
        try {
            if (!req.ctx?.user && !req.ctx?.isSuperUser) {
                res.status(401).json({ error: 'unauthorized', error_description: 'Login required to import kennels' });
                return;
            }
            const bundle = req.body;
            if (!bundle?.kennel || !Array.isArray(bundle.dogs)) {
                res.status(400).json({ error: 'Invalid bundle: kennel and dogs[] required' });
                return;
            }

            // 1. Collect every base: ref the bundle relies on — from dog parents
            //    and from the kennel's own dogIds — and verify they all exist locally.
            const baseRefs = new Set<string>();
            const addBase = (ref: unknown) => {
                if (typeof ref === 'string' && ref.startsWith('base:')) baseRefs.add(ref);
            };
            for (const dog of bundle.dogs) {
                const cfg = dog?.config || {};
                (cfg.parentsRequired || []).forEach(addBase);
                (cfg.parentsOptional || []).forEach(addBase);
            }
            (bundle.kennel.dogIds || []).forEach(addBase);

            const missingBase: string[] = [];
            for (const ref of baseRefs) {
                const name = ref.substring('base:'.length);
                if (!this.baseDogsMap.has(name)) missingBase.push(ref);
            }
            if (missingBase.length > 0) {
                res.status(400).json({
                    error: `Import fehlgeschlagen: Base-Dogs fehlen im Zielsystem: ${missingBase.join(', ')}`,
                });
                return;
            }

            // 2. Resolve kennel ID — if it already exists, find a free copy name.
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

            const lineageErr = kennelLineageIdBlockedReason(kennelId);
            if (lineageErr) {
                res.status(400).json({ error: lineageErr });
                return;
            }
            const displayErr = kennelDisplayNameBlockedReason(kennelName);
            if (displayErr) {
                res.status(400).json({ error: displayErr });
                return;
            }

            // 3. Build ID mapping for serialized/mimic dogs: old lineageId + old versionId → new lineageId.
            const idMap = new Map<string, string>();
            for (const dog of bundle.dogs) {
                const newLineageId = generateLineageId();
                if (dog.lineageId) idMap.set(dog.lineageId, newLineageId);
                if (dog.versionId) idMap.set(dog.versionId, newLineageId);
            }

            const remap = (ref: string): string => {
                if (typeof ref !== 'string') return ref;
                if (ref.startsWith('base:')) return ref; // base refs travel untouched
                return idMap.get(ref) ?? ref;
            };

            // 4. Persist every dog with fresh GUIDs and remapped parent refs.
            for (const dog of bundle.dogs) {
                const newLineageId = idMap.get(dog.lineageId) || idMap.get(dog.versionId) || generateLineageId();
                const newVersionId = generateVersionId();

                const cfg = { ...(dog.config || {}) };
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

            // 5. Create the kennel as a single fresh version — no history restore.
            //    Imported kennels get ownerId from the importer; visibility defaults to private
            //    (the bundle's visibility hint can override).
            const remappedDogIds = (bundle.kennel.dogIds || []).map(remap);
            const importerId = req.ctx?.user?.id ?? null;
            const importedVisibility = bundle.kennel.visibility === 'public' ? 'public' : 'private';
            const remappedNodes = Array.isArray(bundle.kennel.nodes)
                ? bundle.kennel.nodes.map((n: any) => ({ ...n, id: remap(n.id) }))
                : undefined;
            const remappedEdges = Array.isArray(bundle.kennel.edges)
                ? bundle.kennel.edges.map((e: any) => ({
                    ...e,
                    fromId: remap(e.fromId),
                    toId: remap(e.toId),
                }))
                : undefined;
            const createResult = await this.kennelsController.create({
                id: kennelId,
                name: kennelName,
                description: bundle.kennel.description,
                emoji: bundle.kennel.emoji,
                dogIds: remappedDogIds,
                task: bundle.kennel.task,
                nodes: remappedNodes,
                edges: remappedEdges,
                visibility: importedVisibility,
                ownerId: req.ctx?.isSuperUser ? null : importerId,
            } as any);
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
