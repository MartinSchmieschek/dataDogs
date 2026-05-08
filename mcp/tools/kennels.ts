// Kennel tools — list, get, create, update, delete, run, execute.
// Each respects the visibility/ownership rules; super-user (dev mode) bypasses.

import { canRead, canMutate, filterReadable, applyCreateDefaults } from '../auth/visibility';
import { type ToolDef, type ToolDeps, ok, fail } from './types';

export function getKennelTools(): ToolDef[] {
    return [
        {
            name: 'list_kennels',
            description:
                'Lists all kennels visible to the current user (public + own private). Returns id, name, description, dogIds, defaultQuery, visibility and ownerId for each.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            handler: async (_args, ctx, deps) => {
                const result = await deps.kennelsController.listLatest();
                if (!result.ok) return fail(result.error ?? 'list failed');
                const visible = filterReadable(result.data ?? [], ctx);
                return ok(visible);
            },
        },
        {
            name: 'get_kennel',
            description:
                'Loads a single kennel by lineageId or version-id. Returns 404-equivalent (error) if the kennel is private and the caller is not the owner.',
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
                return ok(result.data);
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
                'Runs a kennel and returns the full Waves diagnostic — every dog\'s yield, errors and timing. Use this to debug or to inspect intermediate spoils. For only the lead\'s output, use execute_kennel instead.',
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
