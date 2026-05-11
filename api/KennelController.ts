// The KennelController — keeper of the kennels, master of which hounds hunt together.
// Now versioned: every save breeds a new incarnation, and the lineage branches like cursed coral.
import { AbstractController, ICreateInput, IUpdateInput, IControllerResponse } from './AbstractController';
import { IStore } from '../store/IStore';
import {
    IKennelConfig,
    IKennelNodeAnnotation,
    IKennelEdgeAnnotation,
    isRuntimeLogVerbose,
    kennelDisplayNameBlockedReason,
    kennelLineageIdBlockedReason,
} from '@datadogs/core';
import { generateVersionId } from './utils/versioning';

/**
 * Cargo manifest for raising a new kennel from the void.
 * The id becomes the lineageId — the kennel's stable identity across all versions.
 */
export interface ICreateKennelInput extends ICreateInput {
    id?: string;
    name?: string;
    description?: string;
    emoji?: string;
    dogIds?: string[];
    task?: string;
    nodes?: IKennelNodeAnnotation[];
    edges?: IKennelEdgeAnnotation[];
}

/**
 * Cargo manifest for updating an existing kennel.
 * The id must be named — it is the version ID or lineageId of the kennel to update.
 */
export interface ISaveKennelInput extends IUpdateInput {
    id: string;
    name?: string;
    description?: string;
    dogIds?: string[];
    defaultQuery?: Record<string, string>;
    defaultBody?: any;
    task?: string;
    nodes?: IKennelNodeAnnotation[];
    edges?: IKennelEdgeAnnotation[];
}

/**
 * The KennelController — a versioned captain for IKennelConfig entities.
 * Each save creates a new version row; the lineageId (user-chosen kennel ID) stays stable.
 */
export class KennelController extends AbstractController<IKennelConfig> {
    private readonly KENNEL_TYPE = 'KennelConfig';

    constructor(store: IStore) {
        super(store, 'KennelConfig');
    }

    /**
     * Raises a new kennel from the abyss.
     * The user-chosen id (e.g. "my-kennel") becomes the lineageId.
     * A fresh GUID is forged as the version id (first incarnation).
     */
    async create(input: ICreateKennelInput): Promise<IControllerResponse<IKennelConfig>> {
        try {
            if (input.id?.trim()) {
                const idErr = kennelLineageIdBlockedReason(input.id);
                if (idErr) return { ok: false, error: idErr };
            }
            if (input.name?.trim()) {
                const nameErr = kennelDisplayNameBlockedReason(input.name);
                if (nameErr) return { ok: false, error: nameErr };
            }

            const lineageId = input.id || `kennel-${Date.now()}`;
            const versionId = generateVersionId();

            const config: IKennelConfig = {
                id: versionId,
                name: input.name || undefined,
                description: input.description || undefined,
                emoji: input.emoji?.trim() || undefined,
                dogIds: input.dogIds || [],
                task: input.task || undefined,
                nodes: input.nodes,
                edges: input.edges,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            if (isRuntimeLogVerbose()) {
                console.log(`[KennelController.create] Erstelle neue Kennel-Config: lineageId=${lineageId}, versionId=${versionId}`);
            }

            await this.store.save({
                id: versionId,
                type: this.KENNEL_TYPE,
                lineageId,
                parentId: null,
                name: config.name,
                description: config.description,
                emoji: config.emoji,
                dogIds: config.dogIds,
                defaultQuery: config.defaultQuery ? JSON.stringify(config.defaultQuery) : undefined,
                defaultBody: config.defaultBody ? JSON.stringify(config.defaultBody) : undefined,
                task: config.task,
                nodes: config.nodes ? JSON.stringify(config.nodes) : undefined,
                edges: config.edges ? JSON.stringify(config.edges) : undefined,
                createdAt: config.createdAt?.toISOString(),
                updatedAt: config.updatedAt?.toISOString()
            });

            // Attach lineageId to the returned config so callers can reference the kennel stably.
            const result = { ...config, lineageId } as any;

            if (isRuntimeLogVerbose()) {
                console.log(`[KennelController.create] Erfolgreich gespeichert: lineageId=${lineageId}`);
            }
            return {
                ok: true,
                id: lineageId,
                data: result
            };
        } catch (error) {
            console.error('[KennelController.create] Fehler:', error);
            return { ok: false, error: String(error) };
        }
    }

    /**
     * Updates an existing kennel — each save breeds a new version row.
     * The old version remains in the deep, preserved like a barnacled wreck.
     * input.id can be a lineageId (resolves to latest) or a version GUID (exact version).
     */
    async save(input: ISaveKennelInput): Promise<IControllerResponse<IKennelConfig>> {
        try {
            if (!input.id) {
                return { ok: false, error: 'id is required' };
            }
            if (input.name !== undefined && input.name !== null && String(input.name).trim()) {
                const nameErr = kennelDisplayNameBlockedReason(String(input.name));
                if (nameErr) return { ok: false, error: nameErr };
            }

            // Resolve the existing kennel — by version ID or lineageId.
            const existing = await this.resolveKennel(input.id);
            if (!existing) {
                return { ok: false, error: `Kennel mit ID ${input.id} nicht gefunden` };
            }

            // Merge new cargo with what was already in the hold.
            const config: IKennelConfig = {
                id: existing.id, // will be replaced by new versionId
                name: input.name !== undefined ? input.name : (existing.name || undefined),
                description: input.description !== undefined ? input.description : (existing.description || undefined),
                emoji:
                    input.emoji !== undefined
                        ? (input.emoji.trim() === '' ? undefined : input.emoji.trim())
                        : (existing.emoji || undefined),
                dogIds: input.dogIds !== undefined ? input.dogIds : (existing.dogIds || []),
                defaultQuery: input.defaultQuery !== undefined ? input.defaultQuery : (existing.defaultQuery || undefined),
                defaultBody: input.defaultBody !== undefined ? input.defaultBody : (existing.defaultBody || undefined),
                task: input.task !== undefined ? (input.task || undefined) : (existing.task || undefined),
                nodes: input.nodes !== undefined ? input.nodes : (existing.nodes),
                edges: input.edges !== undefined ? input.edges : (existing.edges),
                createdAt: existing.createdAt || new Date(),
                updatedAt: new Date()
            };

            const contentChanged = this.hasContentChanged(existing, config);

            // Check if content actually changed — spare the deep from phantom versions.
            if (!contentChanged) {
                return {
                    ok: true,
                    id: (existing as any).lineageId || input.id,
                    data: existing
                };
            }

            // New incarnation — forge a new version GUID.
            const newVersionId = generateVersionId();
            const lineageId = (existing as any).lineageId || input.id;
            const parentId = existing.id; // The ancestor from which this incarnation was born

            if (isRuntimeLogVerbose()) {
                console.log(`[KennelController.save] Neue Version: ${newVersionId}, parentId=${parentId}, lineageId=${lineageId}`);
            }

            await this.store.save({
                id: newVersionId,
                type: this.KENNEL_TYPE,
                lineageId,
                parentId,
                name: config.name,
                description: config.description,
                emoji: config.emoji,
                dogIds: config.dogIds,
                defaultQuery: config.defaultQuery ? JSON.stringify(config.defaultQuery) : undefined,
                defaultBody: config.defaultBody ? JSON.stringify(config.defaultBody) : undefined,
                task: config.task,
                nodes: config.nodes ? JSON.stringify(config.nodes) : undefined,
                edges: config.edges ? JSON.stringify(config.edges) : undefined,
                createdAt: new Date().toISOString(),
                updatedAt: config.updatedAt?.toISOString()
            });

            const result = { ...config, id: newVersionId, lineageId } as any;

            if (isRuntimeLogVerbose()) {
                console.log(`[KennelController.save] Erfolgreich gespeichert: ${newVersionId}`);
            }
            return {
                ok: true,
                id: lineageId,
                data: result
            };
        } catch (error) {
            console.error('[KennelController.save] Fehler:', error);
            return { ok: false, error: String(error) };
        }
    }

    /**
     * Compare kennel configs — if content is identical, no new version shall be born.
     */
    private hasContentChanged(old: IKennelConfig, next: IKennelConfig): boolean {
        const contentKeys: (keyof IKennelConfig)[] = [
            'name', 'description', 'emoji', 'dogIds',
            'defaultQuery', 'defaultBody',
            'task', 'nodes', 'edges',
        ];
        for (const key of contentKeys) {
            if (JSON.stringify(old[key]) !== JSON.stringify(next[key])) return true;
        }
        return false;
    }

    /**
     * Heal the current version — mend its wounds without reincarnation.
     * Used for internal bookkeeping (e.g. auto-mimic dogIds additions)
     * that should not pollute the version history.
     */
    async heal(id: string, patch: Partial<ISaveKennelInput>): Promise<IControllerResponse<IKennelConfig>> {
        try {
            if (patch.name !== undefined && patch.name !== null && String(patch.name).trim()) {
                const nameErr = kennelDisplayNameBlockedReason(String(patch.name));
                if (nameErr) return { ok: false, error: nameErr };
            }

            const existing = await this.resolveKennel(id);
            if (!existing) {
                return { ok: false, error: `Kennel mit ID ${id} nicht gefunden` };
            }

            const versionId = existing.id;
            const lineageId = (existing as any).lineageId || id;

            const nextTask = patch.task !== undefined ? patch.task : existing.task;
            const nextNodes = patch.nodes !== undefined ? patch.nodes : existing.nodes;
            const nextEdges = patch.edges !== undefined ? patch.edges : existing.edges;

            await this.store.save({
                id: versionId,
                type: this.KENNEL_TYPE,
                lineageId,
                parentId: (existing as any).parentId ?? null,
                name: patch.name !== undefined ? patch.name : existing.name,
                description: patch.description !== undefined ? patch.description : existing.description,
                emoji: patch.emoji !== undefined ? patch.emoji : existing.emoji,
                dogIds: patch.dogIds !== undefined ? patch.dogIds : existing.dogIds,
                defaultQuery: (patch.defaultQuery !== undefined ? patch.defaultQuery : existing.defaultQuery)
                    ? JSON.stringify(patch.defaultQuery !== undefined ? patch.defaultQuery : existing.defaultQuery) : undefined,
                defaultBody: (patch.defaultBody !== undefined ? patch.defaultBody : existing.defaultBody)
                    ? JSON.stringify(patch.defaultBody !== undefined ? patch.defaultBody : existing.defaultBody) : undefined,
                task: nextTask || undefined,
                nodes: nextNodes ? JSON.stringify(nextNodes) : undefined,
                edges: nextEdges ? JSON.stringify(nextEdges) : undefined,
                createdAt: existing.createdAt?.toISOString(),
                updatedAt: new Date().toISOString(),
            });

            return { ok: true, id: lineageId, data: existing };
        } catch (error) {
            return { ok: false, error: String(error) };
        }
    }

    /**
     * Delete a kennel and ALL its versions.
     * Accepts lineageId or version-GUID — resolves lineageId first, then deletes every incarnation.
     */
    async delete(id: string): Promise<IControllerResponse<void>> {
        try {
            // Resolve to lineageId.
            const resolved = await this.resolveKennel(id);
            if (!resolved) {
                return { ok: false, error: `Kennel mit ID ${id} nicht gefunden` };
            }
            const lineageId = (resolved as any).lineageId || id;

            // Find all versions and delete each one.
            const versions = await this.store.findAllVersions(this.entityType, lineageId);
            for (const v of versions) {
                await this.store.delete(v.id);
            }

            // If no versions found, try deleting by the id directly (fallback).
            if (versions.length === 0) {
                await this.store.delete(id);
            }

            return { ok: true };
        } catch (error) {
            return { ok: false, error: String(error) };
        }
    }

    /**
     * Effective timestamp for ordering Kennel rows — createdAt plus heal bumps on updatedAt.
     * SQLite may round DateTime to whole seconds; two saves in the same second used to make
     * sort-by-createdAt alone pick the wrong "latest" row (defaults vanished after reload).
     */
    private kennelRowRankMs(row: any): number {
        const c = row?.createdAt ? new Date(row.createdAt).getTime() : 0;
        const u = row?.updatedAt ? new Date(row.updatedAt).getTime() : 0;
        return Math.max(c, u);
    }

    /**
     * Pick the newest KennelConfig store row for one lineage: prefer leaves of the parentId chain,
     * then rank by max(createdAt, updatedAt), then id for a stable tie-break.
     */
    private pickLatestKennelStoreRow(rows: any[]): any {
        if (!rows?.length) {
            throw new Error('pickLatestKennelStoreRow: empty');
        }
        if (rows.length === 1) {
            return rows[0];
        }
        const leaves = rows.filter((r) => !rows.some((x) => x.parentId === r.id));
        const candidates = leaves.length > 0 ? leaves : rows;
        return candidates.reduce((best: any, cur: any) => {
            const bt = this.kennelRowRankMs(best);
            const ct = this.kennelRowRankMs(cur);
            if (ct > bt) {
                return cur;
            }
            if (ct < bt) {
                return best;
            }
            return String(cur.id) > String(best.id) ? cur : best;
        });
    }

    /**
     * Resolves a kennel by version ID or lineageId.
     * First tries exact match (version GUID), then resolves as lineageId (latest version).
     */
    private async resolveKennel(id: string): Promise<IKennelConfig | null> {
        // First: try exact match by version ID.
        const exactData = await this.store.load(id);
        if (exactData) {
            const parsed = this.parseEntity(exactData);
            // Verify it's actually a KennelConfig (not a dog with the same ID)
            if (exactData.type === this.KENNEL_TYPE || exactData.name !== undefined || exactData.dogIds !== undefined) {
                return parsed;
            }
        }

        // Second: treat as lineageId — find the latest version of this kennel.
        const allKennels = await this.store.findByType(this.KENNEL_TYPE);
        const lineageRows = allKennels.filter((r: any) => r.lineageId === id);

        if (lineageRows.length > 0) {
            const row = this.pickLatestKennelStoreRow(lineageRows);
            const parsed = this.parseEntity(row);
            if (row.id) parsed.id = row.id;
            return parsed;
        }

        return null;
    }

    /**
     * Overrides getById — uses 2-stage resolution: version GUID first, then lineageId → latest.
     */
    async getById(id: string): Promise<IControllerResponse<IKennelConfig | null>> {
        try {
            const resolved = await this.resolveKennel(id);
            if (!resolved) {
                return { ok: false, error: `Kennel mit ID ${id} nicht gefunden`, data: null };
            }
            return { ok: true, data: resolved };
        } catch (error) {
            return { ok: false, error: String(error), data: null };
        }
    }

    /**
     * Lists all kennels — only the newest version per lineageId.
     */
    async list(filter?: Partial<IKennelConfig>): Promise<IControllerResponse<IKennelConfig[]>> {
        try {
            const results = await this.store.findByType(this.entityType);

            // Group raw rows by lineage (stable "latest" even when createdAt ties on the same second).
            const byLineage = new Map<string, any[]>();
            for (const r of results as any[]) {
                const key = r.lineageId || r.id;
                if (!byLineage.has(key)) {
                    byLineage.set(key, []);
                }
                byLineage.get(key)!.push(r);
            }

            let entities: IKennelConfig[] = [];
            for (const group of byLineage.values()) {
                const row = this.pickLatestKennelStoreRow(group);
                const parsed = this.parseEntity(row);
                if (row.id) parsed.id = row.id;
                (parsed as any).lineageId = row.lineageId;
                entities.push(parsed);
            }

            // Apply the filter if cast.
            if (filter) {
                entities = entities.filter((entity: IKennelConfig) => {
                    return Object.keys(filter).every(key => {
                        return entity[key as keyof IKennelConfig] === filter[key as keyof IKennelConfig];
                    });
                });
            }

            return { ok: true, data: entities };
        } catch (error) {
            return { ok: false, error: String(error), data: [] };
        }
    }

    /**
     * Also override listLatest — same as list(), returns only newest per lineageId.
     */
    async listLatest(): Promise<IControllerResponse<IKennelConfig[]>> {
        return this.list();
    }

    /**
     * Summon all versions of a kennel — every incarnation, newest first.
     * The id can be a lineageId or a version GUID (resolves to lineageId first).
     */
    async getVersions(lineageIdOrVersionId: string): Promise<Array<{ id: string; version: number; config: any; parentId?: string | null; createdAt?: Date }>> {
        // First try as lineageId directly.
        let versions = await this.store.findAllVersions(this.entityType, lineageIdOrVersionId);

        // If nothing found, try loading by version ID to discover the lineageId.
        if (versions.length === 0) {
            const single = await this.store.load(lineageIdOrVersionId);
            if (single) {
                const lineageId = single.lineageId;
                if (lineageId) {
                    versions = await this.store.findAllVersions(this.entityType, lineageId);
                }
            }
        }

        return versions.map(v => {
            const parsed = this.parseEntity(v);
            return {
                id: v.id,
                version: 0,
                config: parsed,
                parentId: v.parentId ?? null,
                createdAt: v.createdAt ?? undefined,
            };
        });
    }

    /**
     * Parses a raw store payload into an IKennelConfig.
     * The dogIds, defaultQuery, and defaultBody are JSON strings in the deep —
     * they must be unshackled before they can be used by the crew.
     */
    protected parseEntity(data: any): IKennelConfig {
        if (!data || typeof data !== 'object') {
            throw new Error('parseEntity: data ist kein Objekt');
        }

        // Unshackle dogIds from its JSON-string prison.
        let dogIds: string[] = [];
        if (data.dogIds !== null && data.dogIds !== undefined) {
            if (typeof data.dogIds === 'string') {
                if (data.dogIds.trim() !== '') {
                    try {
                        const parsed = JSON.parse(data.dogIds);
                        dogIds = Array.isArray(parsed) ? parsed : [];
                    } catch (e) {
                        dogIds = [];
                    }
                }
            } else if (Array.isArray(data.dogIds)) {
                dogIds = data.dogIds;
            }
        }

        // Unshackle defaultQuery.
        let defaultQuery: Record<string, string> | undefined = undefined;
        if (data.defaultQuery) {
            if (typeof data.defaultQuery === 'string') {
                try {
                    defaultQuery = JSON.parse(data.defaultQuery);
                } catch (e) {
                    console.warn('[parseEntity] Fehler beim Parsen von defaultQuery:', e);
                }
            } else if (typeof data.defaultQuery === 'object') {
                defaultQuery = data.defaultQuery;
            }
        }

        // Unshackle defaultBody.
        let defaultBody: any = undefined;
        if (data.defaultBody !== null && data.defaultBody !== undefined) {
            if (typeof data.defaultBody === 'string') {
                try {
                    defaultBody = JSON.parse(data.defaultBody);
                } catch (e) {
                    console.warn('[parseEntity] Fehler beim Parsen von defaultBody:', e);
                }
            } else {
                defaultBody = data.defaultBody;
            }
        }

        if (!Array.isArray(dogIds)) {
            dogIds = [];
        }

        // Unshackle nodes (layout + comments) and edges (transition comments).
        let nodes: IKennelNodeAnnotation[] | undefined = undefined;
        if (data.nodes !== null && data.nodes !== undefined) {
            if (typeof data.nodes === 'string') {
                if (data.nodes.trim() !== '') {
                    try {
                        const parsed = JSON.parse(data.nodes);
                        nodes = Array.isArray(parsed) ? parsed : undefined;
                    } catch (e) {
                        console.warn('[parseEntity] Fehler beim Parsen von nodes:', e);
                    }
                }
            } else if (Array.isArray(data.nodes)) {
                nodes = data.nodes;
            }
        }

        let edges: IKennelEdgeAnnotation[] | undefined = undefined;
        if (data.edges !== null && data.edges !== undefined) {
            if (typeof data.edges === 'string') {
                if (data.edges.trim() !== '') {
                    try {
                        const parsed = JSON.parse(data.edges);
                        edges = Array.isArray(parsed) ? parsed : undefined;
                    } catch (e) {
                        console.warn('[parseEntity] Fehler beim Parsen von edges:', e);
                    }
                }
            } else if (Array.isArray(data.edges)) {
                edges = data.edges;
            }
        }

        const task: string | undefined =
            typeof data.task === 'string' && data.task.length > 0 ? data.task : undefined;

        const result: any = {
            id: data.id,
            name: data.name,
            description: data.description,
            emoji: typeof data.emoji === 'string' && data.emoji.trim() !== '' ? data.emoji.trim() : undefined,
            dogIds: dogIds,
            defaultQuery,
            defaultBody,
            task,
            nodes,
            edges,
            createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
            updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined
        };

        // Preserve lineageId and parentId for version tracking.
        if (data.lineageId) result.lineageId = data.lineageId;
        if (data.parentId !== undefined) result.parentId = data.parentId;

        return result as IKennelConfig;
    }
}
