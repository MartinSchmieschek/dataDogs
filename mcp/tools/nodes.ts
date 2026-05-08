// Node (Hunter / Breed) tools — list, create, save code, get versions.
// Nodes carry the same visibility/ownership model as Kennels: each Breed has an
// ownerId, optional editors/viewers, and can be public or private. The mutate-
// check additionally allows kennel-owners (or kennel-editors) of any kennel
// referencing the node — see canMutateNode.

import { canRead, canMutate, filterReadable, applyCreateDefaults } from '../auth/visibility';
import { canMutateNode } from '../auth/permissions';
import { type ToolDef, ok, fail } from './types';

export function getNodeTools(): ToolDef[] {
    return [
        {
            name: 'list_nodes',
            description:
                'Lists nodes visible to the current user — Hunters (BaseDogs) are always shown, Breeds (SerializedDogs) are filtered by visibility (public + own private). Each entry has id, lineageId, displayName, type, visibility, ownerId and (for Breeds) tsCode.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            handler: async (_args, ctx, deps) => {
                const result = await deps.nodesController.listLatest();
                if (!result.ok) return fail(result.error ?? 'list failed');
                const visibleSerialized = filterReadable(result.data ?? [], ctx);
                // Hunters are project-wide infrastructure: always visible, no ownership.
                return ok([...deps.baseDogsList, ...visibleSerialized]);
            },
        },
        {
            name: 'create_node',
            description:
                'Creates a new Breed (SerializedDog). Defaults visibility to "private" and ownerId to the current user. Pass "visibility":"public" to share. Parents are referenced as either "ClassName" for Hunters or a lineageId GUID for Breeds.',
            inputSchema: {
                type: 'object',
                required: ['displayName'],
                additionalProperties: false,
                properties: {
                    displayName: { type: 'string' },
                    tsCode: { type: 'string', description: 'TypeScript body (return yields the spoils)' },
                    parentsRequired: { type: 'array', items: { type: 'string' } },
                    parentsOptional: { type: 'array', items: { type: 'string' } },
                    icon: { type: 'string', description: 'one emoji' },
                    visibility: { type: 'string', enum: ['public', 'private'] },
                },
            },
            handler: async (args, ctx, deps) => {
                if (!canMutate(null, ctx)) return fail('Login required to create nodes');
                const baseInput = {
                    displayName: String(args.displayName),
                    theRun: String(args.tsCode ?? 'return {}'),
                    parentsRequired: Array.isArray(args.parentsRequired) ? args.parentsRequired : [],
                    parentsOptional: Array.isArray(args.parentsOptional) ? args.parentsOptional : [],
                    ...(typeof args.icon === 'string' ? { icon: args.icon } : {}),
                    ...(args.visibility ? { visibility: args.visibility } : {}),
                };
                const input = applyCreateDefaults(baseInput, ctx);
                const result = await deps.nodesController.create(input);
                if (!result.ok) return fail(result.error ?? 'create failed');
                return ok({ id: result.id, node: result.data });
            },
        },
        {
            name: 'save_node',
            description:
                'Saves a new version of a Breed (SerializedDog). Only the owner (or super-user) can save. Pass id (lineageId or version GUID), tsCode and updated parents. For Mimics, also pass serializedDogConfig with the imitates field intact. Pass "visibility" to flip public/private.',
            inputSchema: {
                type: 'object',
                required: ['id', 'tsCode'],
                additionalProperties: false,
                properties: {
                    id: { type: 'string' },
                    tsCode: { type: 'string' },
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
                const existingConfig = (args.serializedDogConfig as Record<string, any>) ?? {};
                const input = {
                    ...existingConfig,
                    id,
                    theRun: String(args.tsCode),
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
