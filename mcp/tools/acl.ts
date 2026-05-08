// ACL management tools — grant_access, revoke_access, list_collaborators.
//
// Permission model: only the entity's owner (or super-user) may manage its ACL.
// Community-owned entities (ownerId=null, legacy) can be managed by any logged-in
// user — granting access effectively claims the entity if 'owner' role is used.

import type { PrismaClient } from '../../store/generated/prisma-auth-client';
import { canMutate, parseList, serializeList, isCommunityOwned } from '../auth/visibility';
import { type ToolDef, type ToolDeps, ok, fail } from './types';

type EntityType = 'kennel' | 'node';
type AclRole = 'editor' | 'viewer' | 'owner';

interface ResolvedUser {
    id: string;
    email: string;
    name: string | null;
}

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function resolveUser(prisma: PrismaClient, ref: string): Promise<ResolvedUser | null> {
    if (!ref || typeof ref !== 'string') return null;
    if (EMAIL_RX.test(ref)) {
        const u = await prisma.user.findUnique({
            where: { email: ref },
            select: { id: true, email: true, name: true },
        });
        return u;
    }
    // Treat as user.id — verify it exists.
    const u = await prisma.user.findUnique({
        where: { id: ref },
        select: { id: true, email: true, name: true },
    });
    return u;
}

async function loadEntity(deps: ToolDeps, entityType: EntityType, id: string) {
    if (entityType === 'kennel') {
        const r = await deps.kennelsController.getById(id);
        return r.ok && r.data ? r.data : null;
    }
    const r = await deps.nodesController.getById(id);
    return r.ok && r.data ? r.data : null;
}

async function saveEntity(
    deps: ToolDeps,
    entityType: EntityType,
    id: string,
    patch: { ownerId?: string | null; editors?: string | null; viewers?: string | null },
): Promise<{ ok: boolean; error?: string }> {
    if (entityType === 'kennel') {
        const r = await deps.kennelsController.save({ id, ...patch } as any);
        return { ok: r.ok, error: r.error };
    }
    const r = await deps.nodesController.save({ id, ...patch } as any);
    return { ok: r.ok, error: r.error };
}

/** Owner / super-user / community-owned can manage ACL. Pure editors cannot. */
function canManageAcl(entity: any, ctx: any): boolean {
    if (ctx?.isSuperUser) return true;
    if (!ctx?.user) return false;
    if (entity.ownerId === ctx.user.id) return true;
    if (isCommunityOwned(entity)) return true;
    return false;
}

export function getAclTools(): ToolDef[] {
    return [
        {
            name: 'grant_access',
            description:
                'Grant a user access to a kennel or node. role="editor" adds them to editors[] (can mutate). role="viewer" adds them to viewers[] (can read private). role="owner" transfers ownership — irreversible without the new owner consenting. user can be an email or a User.id GUID.',
            inputSchema: {
                type: 'object',
                required: ['entity_type', 'id', 'user', 'role'],
                additionalProperties: false,
                properties: {
                    entity_type: { type: 'string', enum: ['kennel', 'node'] },
                    id: { type: 'string', description: 'lineageId or version GUID' },
                    user: { type: 'string', description: 'user email OR User.id GUID' },
                    role: { type: 'string', enum: ['editor', 'viewer', 'owner'] },
                },
            },
            handler: async (args, ctx, deps) => {
                const entityType = args.entity_type as EntityType;
                const id = String(args.id);
                const role = args.role as AclRole;

                const entity = await loadEntity(deps, entityType, id);
                if (!entity) return fail(`${entityType} ${id} not found`);
                if (!canManageAcl(entity, ctx)) {
                    return fail(canMutate(entity, ctx) ? 'Only the owner may manage access' : `${entityType} ${id} not found`);
                }

                const user = await resolveUser(deps.prisma, String(args.user));
                if (!user) return fail(`User not found: ${args.user}`);

                const currentEditors = parseList((entity as any).editors);
                const currentViewers = parseList((entity as any).viewers);

                const currentOwnerId = (entity as any).ownerId as string | null | undefined;

                if (role === 'owner') {
                    if (currentOwnerId === user.id) {
                        return ok({ entity_type: entityType, id, owner: user, action: 'already_owner' });
                    }
                    // Transfer ownership. The new owner gets full rights; remove them from editors/viewers if present.
                    const result = await saveEntity(deps, entityType, id, {
                        ownerId: user.id,
                        editors: serializeList(currentEditors.filter((e) => e !== user.id)),
                        viewers: serializeList(currentViewers.filter((v) => v !== user.id)),
                    });
                    if (!result.ok) return fail(result.error ?? 'transfer failed');
                    return ok({ entity_type: entityType, id, owner: user, action: 'ownership_transferred' });
                }
                if (role === 'editor') {
                    // Owner already has every right an editor would gain — adding to editors[] is redundant.
                    if (currentOwnerId === user.id) {
                        return ok({ entity_type: entityType, id, action: 'redundant_owner_is_editor', user });
                    }
                    if (currentEditors.includes(user.id)) {
                        return ok({ entity_type: entityType, id, action: 'already_editor', user });
                    }
                    const result = await saveEntity(deps, entityType, id, {
                        editors: serializeList([...currentEditors, user.id]),
                    });
                    if (!result.ok) return fail(result.error ?? 'grant failed');
                    return ok({ entity_type: entityType, id, action: 'editor_added', user });
                }
                // viewer
                if (currentOwnerId === user.id) {
                    return ok({ entity_type: entityType, id, action: 'redundant_owner_is_viewer', user });
                }
                if (currentEditors.includes(user.id)) {
                    return ok({ entity_type: entityType, id, action: 'redundant_editor_is_viewer', user });
                }
                if (currentViewers.includes(user.id)) {
                    return ok({ entity_type: entityType, id, action: 'already_viewer', user });
                }
                const result = await saveEntity(deps, entityType, id, {
                    viewers: serializeList([...currentViewers, user.id]),
                });
                if (!result.ok) return fail(result.error ?? 'grant failed');
                return ok({ entity_type: entityType, id, action: 'viewer_added', user });
            },
        },
        {
            name: 'revoke_access',
            description:
                'Remove a user from editors[] or viewers[] of a kennel or node. role="owner" is not allowed via revoke — use grant_access with role="owner" to transfer ownership instead.',
            inputSchema: {
                type: 'object',
                required: ['entity_type', 'id', 'user', 'role'],
                additionalProperties: false,
                properties: {
                    entity_type: { type: 'string', enum: ['kennel', 'node'] },
                    id: { type: 'string' },
                    user: { type: 'string', description: 'user email OR User.id GUID' },
                    role: { type: 'string', enum: ['editor', 'viewer'] },
                },
            },
            handler: async (args, ctx, deps) => {
                const entityType = args.entity_type as EntityType;
                const id = String(args.id);
                const role = args.role as 'editor' | 'viewer';

                const entity = await loadEntity(deps, entityType, id);
                if (!entity) return fail(`${entityType} ${id} not found`);
                if (!canManageAcl(entity, ctx)) {
                    return fail(canMutate(entity, ctx) ? 'Only the owner may manage access' : `${entityType} ${id} not found`);
                }

                const user = await resolveUser(deps.prisma, String(args.user));
                if (!user) return fail(`User not found: ${args.user}`);

                const list = role === 'editor'
                    ? parseList((entity as any).editors)
                    : parseList((entity as any).viewers);
                if (!list.includes(user.id)) {
                    return ok({ entity_type: entityType, id, action: 'not_present', role, user });
                }
                const next = serializeList(list.filter((u) => u !== user.id));
                const patch = role === 'editor' ? { editors: next } : { viewers: next };
                const result = await saveEntity(deps, entityType, id, patch);
                if (!result.ok) return fail(result.error ?? 'revoke failed');
                return ok({ entity_type: entityType, id, action: `${role}_removed`, user });
            },
        },
        {
            name: 'release_ownership',
            description:
                'Releases ownership of a kennel or node — sets ownerId back to null, returning the entity to community-edit mode (any logged-in user reads + mutates). Only the current owner (or super-user) can release. The entity\'s editors[] and viewers[] are kept intact.',
            inputSchema: {
                type: 'object',
                required: ['entity_type', 'id'],
                additionalProperties: false,
                properties: {
                    entity_type: { type: 'string', enum: ['kennel', 'node'] },
                    id: { type: 'string' },
                },
            },
            handler: async (args, ctx, deps) => {
                const entityType = args.entity_type as EntityType;
                const id = String(args.id);
                const entity = await loadEntity(deps, entityType, id);
                if (!entity) return fail(`${entityType} ${id} not found`);
                if ((entity as any).ownerId == null) {
                    return ok({ entity_type: entityType, id, action: 'already_community' });
                }
                if (!ctx?.isSuperUser && (entity as any).ownerId !== ctx?.user?.id) {
                    return fail('Only the current owner may release ownership');
                }
                const result = await saveEntity(deps, entityType, id, { ownerId: null });
                if (!result.ok) return fail(result.error ?? 'release failed');
                return ok({ entity_type: entityType, id, action: 'ownership_released' });
            },
        },
        {
            name: 'list_collaborators',
            description:
                'Returns the full ACL of a kennel or node: owner, editors[], viewers[]. Each user is resolved with id, email and name.',
            inputSchema: {
                type: 'object',
                required: ['entity_type', 'id'],
                additionalProperties: false,
                properties: {
                    entity_type: { type: 'string', enum: ['kennel', 'node'] },
                    id: { type: 'string' },
                },
            },
            handler: async (args, _ctx, deps) => {
                const entityType = args.entity_type as EntityType;
                const id = String(args.id);
                const entity = await loadEntity(deps, entityType, id);
                if (!entity) return fail(`${entityType} ${id} not found`);

                const editorIds = parseList((entity as any).editors);
                const viewerIds = parseList((entity as any).viewers);
                const allIds = [
                    ...((entity as any).ownerId ? [(entity as any).ownerId as string] : []),
                    ...editorIds,
                    ...viewerIds,
                ];

                const users = allIds.length === 0
                    ? []
                    : await deps.prisma.user.findMany({
                        where: { id: { in: Array.from(new Set(allIds)) } },
                        select: { id: true, email: true, name: true },
                    });
                const byId = new Map(users.map((u) => [u.id, u]));
                const lookup = (uid: string) => byId.get(uid) ?? { id: uid, email: '<unknown>', name: null };

                return ok({
                    entity_type: entityType,
                    id,
                    visibility: (entity as any).visibility ?? 'public',
                    owner: (entity as any).ownerId ? lookup((entity as any).ownerId) : null,
                    editors: editorIds.map(lookup),
                    viewers: viewerIds.map(lookup),
                    is_community: isCommunityOwned(entity as any),
                });
            },
        },
    ];
}
