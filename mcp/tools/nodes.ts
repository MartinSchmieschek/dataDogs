// Node (Hunter / Breed) tools — list, create, save code, get versions.
// Nodes carry the same visibility/ownership model as Kennels: each Breed has an
// ownerId, optional editors/viewers, and can be public or private. The mutate-
// check additionally allows kennel-owners (or kennel-editors) of any kennel
// referencing the node — see canMutateNode.

import { canRead, canMutate, filterReadable, applyCreateDefaults } from '../auth/visibility';
import { canMutateNode } from '../auth/permissions';
import { type ToolDef, ok, fail, resolveTsCode } from './types';

export function getNodeTools(): ToolDef[] {
    return [
        {
            name: 'list_nodes',
            description:
                'Lists nodes visible to the current user. Returns a paged window with metadata only (no tsCode). Hunters (BaseDogs) and Breeds (SerializedDogs/MimicDogs) share the same listing. Default limit=50, cap=200. Filter via type, search by name/displayName substring (case-insensitive).',
            inputSchema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    limit: { type: 'number', description: 'max results (default 50, hard cap 200)' },
                    offset: { type: 'number', description: 'skip first N (default 0)' },
                    type: {
                        type: 'string',
                        enum: ['BaseDog', 'SerializedDog', 'MimicDog'],
                        description: 'filter by node type',
                    },
                    search: {
                        type: 'string',
                        description: 'case-insensitive substring match on name and displayName',
                    },
                },
            },
            handler: async (args, ctx, deps) => {
                const result = await deps.nodesController.listLatest();
                if (!result.ok) return fail(result.error ?? 'list failed');
                const visibleSerialized = filterReadable(result.data ?? [], ctx);

                // MimicDog-Heuristik: ein SerializedDog gilt als MimicDog, wenn
                // sein displayName mit "auto-mimic-" beginnt oder sein
                // serializedDogConfig ein `imitates`-Feld traegt. Beides sind
                // die Marker, die der Server beim Auto-Spawn setzt.
                const classifyType = (s: any): 'SerializedDog' | 'MimicDog' => {
                    if (typeof s?.type === 'string' && s.type === 'MimicDog') return 'MimicDog';
                    if (typeof s?.displayName === 'string' && s.displayName.startsWith('auto-mimic-')) return 'MimicDog';
                    if (s?.imitates || s?.serializedDogConfig?.imitates) return 'MimicDog';
                    return 'SerializedDog';
                };

                const all = [
                    ...deps.baseDogsList.map((b) => ({
                        id: b.id,
                        lineageId: undefined as string | undefined,
                        displayName: b.name,
                        name: b.name,
                        icon: b.icon,
                        type: 'BaseDog' as const,
                        visibility: 'public',
                        ownerId: null as string | null,
                        tsCodePreview: null as string | null,
                        parentsRequired: [] as string[],
                        parentsOptional: [] as string[],
                        updatedAt: null as string | null,
                    })),
                    ...visibleSerialized.map((s: any) => {
                        const code = typeof s.theRun === 'string' ? s.theRun : '';
                        const preview =
                            code.length > 200 ? code.substring(0, 200) + '…' : code;
                        return {
                            id: s.id,
                            lineageId: s.lineageId,
                            displayName: s.displayName,
                            name: s.displayName,
                            icon: s.icon,
                            type: classifyType(s),
                            visibility: s.visibility ?? 'public',
                            ownerId: s.ownerId ?? null,
                            tsCodePreview: preview,
                            parentsRequired: s.parentsRequired ?? [],
                            parentsOptional: s.parentsOptional ?? [],
                            updatedAt: s.updatedAt ?? null,
                        };
                    }),
                ];

                const typeFilter = typeof args.type === 'string' ? args.type : undefined;
                const searchRaw = typeof args.search === 'string' ? args.search : undefined;
                const s = searchRaw ? searchRaw.toLowerCase() : undefined;

                const filtered = all.filter((n) => {
                    if (typeFilter && n.type !== typeFilter) return false;
                    if (s) {
                        const name = (n.name ?? '').toLowerCase();
                        const display = (n.displayName ?? '').toLowerCase();
                        if (!name.includes(s) && !display.includes(s)) return false;
                    }
                    return true;
                });

                const total = filtered.length;
                const rawLimit = typeof args.limit === 'number' ? args.limit : 50;
                const limit = Math.max(0, Math.min(200, Math.floor(rawLimit)));
                const rawOffset = typeof args.offset === 'number' ? args.offset : 0;
                const offset = Math.max(0, Math.floor(rawOffset));
                const paged = filtered.slice(offset, offset + limit);

                return ok({
                    nodes: paged,
                    total,
                    offset,
                    limit,
                    hasMore: offset + paged.length < total,
                });
            },
        },
        {
            name: 'get_node',
            description:
                'Returns the full detail of a node — including tsCode and the complete SerializedDogConfig (or BaseDog metadata).',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'lineageId or version GUID, or a BaseDog name' },
                },
            },
            handler: async (args, ctx, deps) => {
                const id = String(args.id);
                // BaseDog first — match against the in-memory list.
                const base = deps.baseDogsList.find(
                    (b) => b.id === id || b.name === id || `base:${b.name}` === id,
                );
                if (base) return ok(base);
                const result = await deps.nodesController.getById(id);
                if (!result.ok || !result.data) return fail(`Node ${id} not found`);
                if (!canRead(result.data as any, ctx)) return fail(`Node ${id} not found`);
                return ok(result.data);
            },
        },
        {
            name: 'get_node_schema',
            description:
                'Returns just the interface of a node — id, lineageId, displayName, name, icon, type, parents. No tsCode, no extra config. Use when you only need to bind to a node\'s shape.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: { id: { type: 'string' } },
            },
            handler: async (args, ctx, deps) => {
                const id = String(args.id);
                const base = deps.baseDogsList.find(
                    (b) => b.id === id || b.name === id || `base:${b.name}` === id,
                );
                if (base) {
                    return ok({
                        id: base.id,
                        lineageId: undefined,
                        displayName: base.name,
                        name: base.name,
                        icon: base.icon,
                        type: 'BaseDog',
                        parentsRequired: [],
                        parentsOptional: [],
                    });
                }
                const result = await deps.nodesController.getById(id);
                if (!result.ok || !result.data) return fail(`Node ${id} not found`);
                if (!canRead(result.data as any, ctx)) return fail(`Node ${id} not found`);
                const s = result.data as any;
                return ok({
                    id: s.id,
                    lineageId: s.lineageId,
                    displayName: s.displayName,
                    name: s.displayName,
                    icon: s.icon,
                    type: 'SerializedDog',
                    parentsRequired: s.parentsRequired ?? [],
                    parentsOptional: s.parentsOptional ?? [],
                });
            },
        },
        {
            name: 'create_node',
            description:
                'Creates a new Breed (SerializedDog). Defaults visibility to "private" and ownerId to the current user. Pass "visibility":"public" to share. Parents are referenced as either "ClassName" for Hunters or a lineageId GUID for Breeds. Use refresh_kennel_snapshot afterwards to see the run state. Provide EITHER tsCode (raw string) OR tsCodeBase64 (utf8 base64) — the base64 form avoids JSON-escape hell for code with backticks, newlines, template literals or PowerShell-hostile quoting.',
            inputSchema: {
                type: 'object',
                required: ['displayName'],
                additionalProperties: false,
                properties: {
                    displayName: { type: 'string' },
                    tsCode: { type: 'string', description: 'TypeScript body (return yields the spoils). Mutually exclusive with tsCodeBase64.' },
                    tsCodeBase64: { type: 'string', description: 'utf8-encoded base64 of the TypeScript body — use this to avoid JSON-escape hell. Mutually exclusive with tsCode.' },
                    parentsRequired: { type: 'array', items: { type: 'string' } },
                    parentsOptional: { type: 'array', items: { type: 'string' } },
                    icon: { type: 'string', description: 'one emoji' },
                    visibility: { type: 'string', enum: ['public', 'private'] },
                },
            },
            handler: async (args, ctx, deps) => {
                if (!canMutate(null, ctx)) return fail('Login required to create nodes');
                // Resolve tsCode/tsCodeBase64. Default to 'return {}' if neither given (back-compat).
                let theRun: string;
                if (typeof args.tsCode === 'string' || typeof args.tsCodeBase64 === 'string') {
                    try {
                        theRun = resolveTsCode(args as any);
                    } catch (err: any) {
                        return fail(err?.message ?? String(err));
                    }
                } else {
                    theRun = 'return {}';
                }
                const baseInput = {
                    displayName: String(args.displayName),
                    theRun,
                    parentsRequired: Array.isArray(args.parentsRequired) ? args.parentsRequired : [],
                    parentsOptional: Array.isArray(args.parentsOptional) ? args.parentsOptional : [],
                    ...(typeof args.icon === 'string' ? { icon: args.icon } : {}),
                    ...(args.visibility ? { visibility: args.visibility } : {}),
                };
                const input = applyCreateDefaults(baseInput, ctx);
                const result = await deps.nodesController.create(input);
                if (!result.ok) return fail(result.error ?? 'create failed');
                return ok({
                    id: result.id,
                    lineageId: (result.data as any)?.lineageId,
                    displayName: (result.data as any)?.displayName,
                });
            },
        },
        {
            name: 'save_node',
            description:
                'Saves a new version of a Breed (SerializedDog). Only the owner (or super-user) can save. Pass id (lineageId or version GUID), tsCode (or tsCodeBase64) and updated parents. For Mimics, also pass serializedDogConfig with the imitates field intact. Pass "visibility" to flip public/private. Provide EITHER tsCode (raw string) OR tsCodeBase64 (utf8 base64) — the base64 form avoids JSON-escape hell.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string' },
                    tsCode: { type: 'string', description: 'TypeScript body. Mutually exclusive with tsCodeBase64.' },
                    tsCodeBase64: { type: 'string', description: 'utf8-encoded base64 of the TypeScript body. Mutually exclusive with tsCode.' },
                    parentsRequired: { type: 'array', items: { type: 'string' } },
                    parentsOptional: { type: 'array', items: { type: 'string' } },
                    serializedDogConfig: { type: 'object' },
                    icon: { type: 'string' },
                    visibility: { type: 'string', enum: ['public', 'private'] },
                },
            },
            handler: async (args, ctx, deps) => {
                const id = String(args.id);
                const existing = await deps.nodesController.getById(id);
                if (!existing.ok || !existing.data) return fail(`Node ${id} not found`);
                const allowed = await canMutateNode(existing.data as any, ctx, deps.kennelsStore);
                if (!allowed) {
                    return fail(canRead(existing.data as any, ctx) ? 'Not authorized' : `Node ${id} not found`);
                }
                let theRun: string;
                try {
                    theRun = resolveTsCode(args as any);
                } catch (err: any) {
                    return fail(err?.message ?? String(err));
                }
                const existingConfig = (args.serializedDogConfig as Record<string, any>) ?? {};
                const input = {
                    ...existingConfig,
                    id,
                    theRun,
                    parentsRequired: Array.isArray(args.parentsRequired)
                        ? args.parentsRequired
                        : existingConfig.parentsRequired ?? [],
                    parentsOptional: Array.isArray(args.parentsOptional)
                        ? args.parentsOptional
                        : existingConfig.parentsOptional ?? [],
                    ...(args.icon !== undefined ? { icon: args.icon } : {}),
                    ...(args.visibility ? { visibility: args.visibility } : {}),
                };
                const result = await deps.nodesController.save(input as any);
                if (!result.ok) return fail(result.error ?? 'save failed');
                return ok({
                    id: result.id,
                    lineageId: (result.data as any)?.lineageId,
                    displayName: (result.data as any)?.displayName,
                });
            },
        },
        {
            name: 'get_node_versions',
            description:
                'Returns the full version history of a node\'s lineage — every incarnation, newest first. Returns "not found" if the node is private and the caller is not the owner.',
            inputSchema: {
                type: 'object',
                required: ['id'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string', description: 'lineageId or any version GUID in the lineage' },
                },
            },
            handler: async (args, ctx, deps) => {
                const id = String(args.id);
                // Visibility gate via the latest incarnation's metadata.
                const head = await deps.nodesController.getById(id);
                if (!head.ok || !head.data) return fail(`Node ${id} not found`);
                if (!canRead(head.data as any, ctx)) return fail(`Node ${id} not found`);
                const versions = await deps.nodesController.getVersions(id);
                return ok(versions);
            },
        },
    ];
}
