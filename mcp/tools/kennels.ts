// Kennel tools — list, get, create, update, delete, run, execute, plus
// granular kennel-detail accessors (defaultBody, defaultQuery, task, layout, versions).
// Each respects the visibility/ownership rules; super-user (dev mode) bypasses.

import { canRead, canMutate, filterReadable, applyCreateDefaults } from '../auth/visibility';
import { type ToolDef, ok, fail } from './types';

/** Minimal projection for list_kennels — no payloads, no layout. */
function leanKennel(k: any) {
    return {
        id: k.id,
        lineageId: k.lineageId,
        name: k.name,
        emoji: k.emoji,
        dogCount: Array.isArray(k.dogIds) ? k.dogIds.length : 0,
        visibility: k.visibility ?? 'public',
        updatedAt: k.updatedAt,
    };
}

/** Header projection for get_kennel — payload presence flagged, not dumped. */
function kennelHeader(k: any) {
    return {
        id: k.id,
        lineageId: k.lineageId,
        parentId: k.parentId ?? null,
        name: k.name,
        description: k.description,
        emoji: k.emoji,
        dogIds: Array.isArray(k.dogIds) ? k.dogIds : [],
        visibility: k.visibility ?? 'public',
        ownerId: k.ownerId ?? null,
        hasDefaultBody: k.defaultBody !== undefined && k.defaultBody !== null,
        hasDefaultQuery: !!(k.defaultQuery && Object.keys(k.defaultQuery).length > 0),
        hasTask: typeof k.task === 'string' && k.task.length > 0,
        hasNodes: Array.isArray(k.nodes) && k.nodes.length > 0,
        hasEdges: Array.isArray(k.edges) && k.edges.length > 0,
        createdAt: k.createdAt,
        updatedAt: k.updatedAt,
    };
}

export function getKennelTools(): ToolDef[] {
    return [
        {
            name: 'list_kennels',
            description:
                'Lists kennels visible to the current user. Returns minimal metadata only (id, lineageId, name, emoji, dogCount, visibility, updatedAt). Use get_kennel for the header, and the get_kennel_* tools for payload fields.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            handler: async (_args, ctx, deps) => {
                const result = await deps.kennelsController.listLatest();
                if (!result.ok) return fail(result.error ?? 'list failed');
                const visible = filterReadable(result.data ?? [], ctx);
                return ok(visible.map(leanKennel));
            },
        },
        {
            name: 'get_kennel',
            description:
                'Returns the header of one kennel — identity, dogIds, visibility, owner, and presence flags for the heavy fields (defaultBody/defaultQuery/task/nodes/edges). Use get_kennel_default_body / _default_query / _task / _layout to fetch those.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'lineageId or version GUID' },
                },
            },
            handler: async (args, ctx, deps) => {
                const result = await deps.kennelsController.getById(String(args.id));
                if (!result.ok || !result.data) return fail(result.error ?? 'not found');
                if (!canRead(result.data as any, ctx)) return fail(`Kennel ${args.id} not found`);
                return ok(kennelHeader(result.data));
            },
        },
        {
            name: 'get_kennel_default_body',
            description: 'Returns the kennel\'s defaultBody JSON.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: { id: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const result = await deps.kennelsController.getById(String(args.id));
                if (!result.ok || !result.data) return fail(`Kennel ${args.id} not found`);
                if (!canRead(result.data as any, ctx)) return fail(`Kennel ${args.id} not found`);
                return ok({ defaultBody: (result.data as any).defaultBody ?? null });
            },
        },
        {
            name: 'get_kennel_default_query',
            description: 'Returns the kennel\'s defaultQuery map.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: { id: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const result = await deps.kennelsController.getById(String(args.id));
                if (!result.ok || !result.data) return fail(`Kennel ${args.id} not found`);
                if (!canRead(result.data as any, ctx)) return fail(`Kennel ${args.id} not found`);
                return ok({ defaultQuery: (result.data as any).defaultQuery ?? {} });
            },
        },
        {
            name: 'get_kennel_task',
            description: 'Returns the kennel\'s task markdown (mission briefing). null if unset.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: { id: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const result = await deps.kennelsController.getById(String(args.id));
                if (!result.ok || !result.data) return fail(`Kennel ${args.id} not found`);
                if (!canRead(result.data as any, ctx)) return fail(`Kennel ${args.id} not found`);
                return ok({ task: (result.data as any).task ?? null });
            },
        },
        {
            name: 'get_kennel_layout',
            description:
                'Returns layout annotations (nodes positions + edges comments) for the kennel\'s wave-view canvas.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: { id: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const result = await deps.kennelsController.getById(String(args.id));
                if (!result.ok || !result.data) return fail(`Kennel ${args.id} not found`);
                if (!canRead(result.data as any, ctx)) return fail(`Kennel ${args.id} not found`);
                return ok({
                    nodes: (result.data as any).nodes ?? [],
                    edges: (result.data as any).edges ?? [],
                });
            },
        },
        {
            name: 'get_kennel_versions',
            description:
                'Lists every version of a kennel\'s lineage. Returns slim version refs (id, parentId, createdAt, displayName) — fetch a specific version\'s details via get_kennel(versionId).',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: { id: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const id = String(args.id);
                const head = await deps.kennelsController.getById(id);
                if (!head.ok || !head.data) return fail(`Kennel ${id} not found`);
                if (!canRead(head.data as any, ctx)) return fail(`Kennel ${id} not found`);
                const versions = await deps.kennelsController.getVersions(id);
                return ok(
                    versions.map((v) => ({
                        id: v.id,
                        parentId: v.parentId ?? null,
                        createdAt: v.createdAt ?? null,
                        displayName: (v.config as any)?.name ?? null,
                    })),
                );
            },
        },
        {
            name: 'create_kennel',
            description:
                'Creates a new kennel. Defaults visibility to "private" and ownerId to the current user. Pass "visibility":"public" to make it publicly accessible. dogIds is the ordered pack — first entry is the lead.',
            inputSchema: {
                type: 'object',
                required: ['id', 'dogIds'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'kennel id (becomes lineageId)' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    emoji: { type: 'string' },
                    dogIds: { type: 'array', items: { type: 'string' } },
                    defaultQuery: { type: 'object', additionalProperties: { type: 'string' } },
                    defaultBody: {},
                    visibility: { type: 'string', enum: ['public', 'private'] },
                },
            },
            handler: async (args, ctx, deps) => {
                if (!canMutate(null, ctx)) return fail('Login required to create kennels');
                const input = applyCreateDefaults(args, ctx);
                const result = await deps.kennelsController.create(input);
                if (!result.ok) return fail(result.error ?? 'create failed');
                return ok({ id: result.id, kennel: result.data });
            },
        },
        {
            name: 'update_kennel',
            description:
                'Updates an existing kennel — creates a new version. Only the owner (or super-user) can update. Pass only the fields you want to change; others are preserved.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'lineageId or version GUID' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    emoji: { type: 'string' },
                    dogIds: { type: 'array', items: { type: 'string' } },
                    defaultQuery: { type: 'object', additionalProperties: { type: 'string' } },
                    defaultBody: {},
                    visibility: { type: 'string', enum: ['public', 'private'] },
                },
            },
            handler: async (args, ctx, deps) => {
                const id = String(args.id);
                const existing = await deps.kennelsController.getById(id);
                if (!existing.ok || !existing.data) return fail(`Kennel ${id} not found`);
                if (!canMutate(existing.data as any, ctx)) {
                    return fail(canRead(existing.data as any, ctx) ? 'Not authorized' : `Kennel ${id} not found`);
                }
                const result = await deps.kennelsController.save({ ...args, id } as any);
                if (!result.ok) return fail(result.error ?? 'update failed');
                return ok({ id: result.id, kennel: result.data });
            },
        },
        {
            name: 'delete_kennel',
            description:
                'Deletes a kennel and ALL its versions. Only the owner (or super-user) can delete. Irreversible — every dog dies forever.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'lineageId or version GUID' },
                },
            },
            handler: async (args, ctx, deps) => {
                const id = String(args.id);
                const existing = await deps.kennelsController.getById(id);
                if (!existing.ok || !existing.data) return fail(`Kennel ${id} not found`);
                if (!canMutate(existing.data as any, ctx)) {
                    return fail(canRead(existing.data as any, ctx) ? 'Not authorized' : `Kennel ${id} not found`);
                }
                const result = await deps.kennelsController.delete(id);
                if (!result.ok) return fail(result.error ?? 'delete failed');
                return ok({ deleted: id });
            },
        },
        {
            name: 'run_kennel',
            description:
                'Runs a kennel and returns the full Waves payload — every dog\'s yield, code, vmContext, errors and timing. WARNING: this can be megabytes per call (5–20 MB on rich kennels). Prefer refresh_kennel_snapshot + the get_snapshot_* / get_kennel_snapshot_* tools for granular access. Use run_kennel only when you truly need every dog\'s details in one shot.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'lineageId or version GUID' },
                    query: {
                        type: 'object',
                        additionalProperties: { type: 'string' },
                        description: 'query parameters (overrides defaultQuery)',
                    },
                    body: { description: 'body data (overrides defaultBody)' },
                },
            },
            handler: async (args, ctx, deps) => {
                const config = await deps.kennelRunHandler.loadKennelConfig(String(args.id));
                if (!config) return fail(`Kennel ${args.id} not found`);
                if (!canRead(config as any, ctx)) return fail(`Kennel ${args.id} not found`);
                const query = deps.kennelRunHandler.mergeQueryParams(
                    config.defaultQuery,
                    (args.query as Record<string, any>) ?? {},
                );
                const body = args.body !== undefined ? args.body : config.defaultBody;
                try {
                    const waves = await deps.kennelRunHandler.runKennel(config, query, body);
                    return ok({ waves, kennelConfig: config });
                } catch (err: any) {
                    return fail(err?.message ?? String(err));
                }
            },
        },
        {
            name: 'execute_kennel',
            description:
                'Runs a kennel and returns ONLY the lead dog\'s result — the public-facing payload. Use this when you want the spoils, not the diagnostic. The lead is the first entry in dogIds.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'lineageId or version GUID' },
                    query: {
                        type: 'object',
                        additionalProperties: { type: 'string' },
                    },
                    body: {},
                },
            },
            handler: async (args, ctx, deps) => {
                const config = await deps.kennelRunHandler.loadKennelConfig(String(args.id));
                if (!config) return fail(`Kennel ${args.id} not found`);
                if (!canRead(config as any, ctx)) return fail(`Kennel ${args.id} not found`);
                const dogIds = config.dogIds ?? [];
                if (dogIds.length === 0) return fail('Kennel has no dogs');
                const query = deps.kennelRunHandler.mergeQueryParams(
                    config.defaultQuery,
                    (args.query as Record<string, any>) ?? {},
                );
                const body = args.body !== undefined ? args.body : config.defaultBody;
                try {
                    const waves = await deps.kennelRunHandler.runKennel(config, query, body);
                    const lead = findDogInWaves(waves, dogIds[0]);
                    if (!lead) return fail(`Lead ${dogIds[0]} not in waves`);
                    return ok(lead.result);
                } catch (err: any) {
                    return fail(err?.message ?? String(err));
                }
            },
        },
    ];
}

function findDogInWaves(waves: any, dogId: string): { result: any } | null {
    if (!waves || !Array.isArray(waves)) return null;
    const searchId = dogId.startsWith('base:') ? dogId.substring(5) : dogId;
    for (const wave of waves) {
        const dogs = Array.isArray(wave) ? wave : wave?.dogs;
        if (!dogs) continue;
        for (const d of dogs) {
            if (d.id === searchId || d.lineageId === searchId || d.displayName === searchId || d.name === searchId) {
                return { result: d.result };
            }
        }
    }
    return null;
}
