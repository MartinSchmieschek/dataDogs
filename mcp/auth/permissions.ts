// Async permission helpers that need DB lookups beyond the pure visibility helpers.
//
// Currently only one rule needs this: a node is editable not just by its own owner
// + editors, but also by every kennel-owner/editor that references it in dogIds.
// "If you depend on a node in your kennel, you can fix it." Predictable trade-off:
// public nodes become de-facto community-editable through any public kennel.

import type { IStore } from '../../store/IStore';
import type { AuthCtx } from './middleware';
import { AclEntity, canMutate, parseList } from './visibility';

/**
 * Mutate-check for a node. Inherits the basic rules from visibility.canMutate, then
 * additionally allows any user who is owner-or-editor of a kennel that references
 * the node's lineageId via dogIds.
 *
 * @param node       The node entity (must include lineageId, ownerId, editors).
 * @param ctx        Auth context.
 * @param kennelStore  The kennels-side IStore (or any store on the same DB) — needed
 *                     to find kennels that reference this node.
 */
export async function canMutateNode(
    node: AclEntity,
    ctx: AuthCtx | undefined,
    kennelStore: IStore,
): Promise<boolean> {
    // Cheap path first.
    if (canMutate(node, ctx)) return true;
    if (!ctx?.user) return false;

    const nodeLineage = node.lineageId ?? node.id;
    if (!nodeLineage) return false;

    // Find every Kennel-row that lists this node in its dogIds. Cheap because we
    // only read the kennels manifest and string-match on the JSON-stringified array.
    const kennelRows = await kennelStore.findByType('KennelConfig');
    for (const row of kennelRows as any[]) {
        const dogIdsRaw = row.dogIds;
        if (!dogIdsRaw) continue;
        let dogIds: string[] = [];
        try {
            dogIds = typeof dogIdsRaw === 'string' ? JSON.parse(dogIdsRaw) : dogIdsRaw;
        } catch { continue; }
        if (!Array.isArray(dogIds)) continue;
        if (!dogIds.includes(String(nodeLineage)) && !dogIds.includes(String(node.id ?? ''))) continue;

        // This kennel references the node. Check if ctx.user is owner or editor of THIS kennel.
        if (row.ownerId === ctx.user.id) return true;
        const kennelEditors = parseList(row.editors);
        if (kennelEditors.includes(ctx.user.id)) return true;
    }

    return false;
}
