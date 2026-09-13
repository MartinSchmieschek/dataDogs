// Visibility & ACL rules for kennels and nodes — single source of truth.
//
// Permission model
// ────────────────
//   ownerId         creator, full rights
//   editors[]       additional users with mutate rights
//   viewers[]       additional users with read rights on PRIVATE entities
//   visibility      "public" | "private" | null  (null = legacy, treated as public)
//
// Implicit rules
//   ownerId = null              → community-editable: any logged-in user reads + mutates
//   visibility ≠ "private"      → anyone (including anonymous) reads + runs
//   visibility === "private"    → only owner + editors + viewers + super-user read
//   mutations                   → only owner + editors + super-user (+ community for null-owner)
//   For nodes: see permissions.ts for the kennel-owner-bypass on edit.

import type { AuthCtx } from './middleware';

export type Visibility = 'public' | 'private';

export interface AclEntity {
    id?: string;
    lineageId?: string;
    visibility?: Visibility | string | null;
    ownerId?: string | null;
    editors?: string[] | string | null;
    viewers?: string[] | string | null;
}

/** Parse a comma-separated User-ID list (DB column) or pass through an array. */
export function parseList(raw: string[] | string | null | undefined): string[] {
    if (Array.isArray(raw)) return raw.filter((s) => typeof s === 'string' && s.length > 0);
    if (typeof raw !== 'string' || raw.length === 0) return [];
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function serializeList(list: string[]): string | null {
    if (!Array.isArray(list) || list.length === 0) return null;
    return Array.from(new Set(list.filter(Boolean))).join(',');
}

export function effectiveVisibility(k: AclEntity): Visibility {
    if (k.visibility === 'public') return 'public';
    if (k.visibility === 'private') return 'private';
    // SECURITY (2026-09-13): fail-closed on a MISSING/null visibility field.
    // The old rule treated null as public — so any entity whose visibility column
    // was never written (or was stripped by a partial projection, see PrismaStore
    // findByType) was world-readable, code and all. Now: a null-owner entity is a
    // legacy/system/community object and stays public (this preserves anonymous
    // access to seed dogs and legacy community kennels); but an entity that HAS an
    // owner yet no explicit visibility is treated as private — an owned thing is not
    // public unless someone said so.
    return isCommunityOwned(k) ? 'public' : 'private';
}

/** True when the entity is community-editable (no owner, treated as shared). */
export function isCommunityOwned(k: AclEntity): boolean {
    return k.ownerId === null || k.ownerId === undefined;
}

/** Can the requester read this entity (list it, fetch it, run it)? */
export function canRead(k: AclEntity, ctx: AuthCtx | undefined): boolean {
    if (ctx?.isSuperUser) return true;
    if (effectiveVisibility(k) === 'public') return true;

    // Private from here on.
    if (!ctx?.user) return false;
    if (k.ownerId === ctx.user.id) return true;
    const editors = parseList(k.editors);
    if (editors.includes(ctx.user.id)) return true;
    const viewers = parseList(k.viewers);
    if (viewers.includes(ctx.user.id)) return true;
    if (isCommunityOwned(k)) return true; // legacy / system entity → community visible
    return false;
}

/**
 * Can the requester create/update/delete this entity? For nodes that may also be
 * editable by kennel-owners-using-them, use {@link permissions.canMutateNode} which
 * adds the kennel-lookup on top of the basics here.
 */
export function canMutate(k: AclEntity | null, ctx: AuthCtx | undefined): boolean {
    if (ctx?.isSuperUser) return true;
    if (!ctx?.user) return false;
    if (!k) return true; // create: any logged-in user may create new
    if (k.ownerId === ctx.user.id) return true;
    if (isCommunityOwned(k)) return true; // legacy unowned → community-editable
    const editors = parseList(k.editors);
    if (editors.includes(ctx.user.id)) return true;
    return false;
}

export function filterReadable<T extends AclEntity>(items: T[], ctx: AuthCtx | undefined): T[] {
    return items.filter((k) => canRead(k, ctx));
}

export function applyCreateDefaults(input: any, ctx: AuthCtx | undefined): any {
    const visibility: Visibility =
        input?.visibility === 'public' || input?.visibility === 'private'
            ? input.visibility
            : ctx?.isSuperUser
            ? 'public'
            : 'private';
    const ownerId = ctx?.isSuperUser ? input?.ownerId ?? null : ctx?.user?.id ?? null;
    return { ...input, visibility, ownerId };
}
