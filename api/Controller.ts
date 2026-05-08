// The Controller — a generic captain that can command any cargo of type T.
// Its heralds are the stars it fells: it manages any Config-type entity,
// sailing the branching seas with GUID-forged identities and lineage tracking.
import { AbstractController, ICreateInput, IUpdateInput, IControllerResponse } from './AbstractController';
import { IStore } from '../store/IStore';
import { generateVersionId, generateLineageId } from './utils/versioning';

/**
 * A generic controller bound to a store — the first mate for any config type.
 * Versioning is enabled by default, fer the past must not be forgotten.
 * Now each incarnation carries a GUID, and the lineage branches like cursed coral in the void.
 */
export class Controller<T extends { id?: string; lineageId?: string; parentId?: string | null; displayName?: string; version?: number; [key: string]: any }> extends AbstractController<T> {
    private enableVersioning: boolean;

    /**
     * @param store - The eldritch store in which all data sleeps.
     * @param entityType - The type brand; defaults to 'Config' if ye name it not.
     * @param enableVersioning - Whether the branching rite shall be performed (default: true).
     */
    constructor(store: IStore, entityType?: string, enableVersioning: boolean = true) {
        super(store, entityType || 'Config');
        this.enableVersioning = enableVersioning;
    }

    /**
     * Births a new entity into the deep — a creation rite.
     * Assigns a GUID as the version ID and forges a fresh lineageId fer the lineage.
     * The firstborn has no ancestor — parentId is null, fer it rose from nothing.
     */
    async create(input: ICreateInput): Promise<IControllerResponse<T>> {
        try {
            const id = this.enableVersioning ? generateVersionId() : (input.id || `${this.entityType.toLowerCase()}-${Date.now()}`);
            const lineageId = this.enableVersioning ? generateLineageId() : undefined;

            // Pull ACL fields off the input — they live on the outer row, not in the config.
            const visibility = (input as any).visibility === 'private' ? 'private'
                : (input as any).visibility === 'public' ? 'public' : undefined;
            const ownerId = (input as any).ownerId !== undefined ? (input as any).ownerId : undefined;
            const editors = (input as any).editors !== undefined ? (input as any).editors : undefined;
            const viewers = (input as any).viewers !== undefined ? (input as any).viewers : undefined;
            const { visibility: _v, ownerId: _o, editors: _e, viewers: _w, ...rest } = (input as any) ?? {};

            const entity: T = {
                ...rest,
                id,
                lineageId,
                parentId: null,
                displayName: rest.displayName || rest.id || id,
            } as T;

            // Resolve the type brand: if the entity imitates a Pact, it is a MimicDog.
            const resolvedType = (input as any).imitates ? 'MimicDog' : this.entityType;

            // Commit the entity to the deep — its soul sealed in the store.
            await this.store.save({
                id,
                type: resolvedType,
                lineageId,
                parentId: null,
                displayName: entity.displayName,
                serializedDogConfig: JSON.stringify(entity),
                ...(visibility !== undefined ? { visibility } : {}),
                ...(ownerId !== undefined ? { ownerId } : {}),
                ...(editors !== undefined ? { editors } : {}),
                ...(viewers !== undefined ? { viewers } : {}),
                createdAt: new Date(),
            });

            return {
                ok: true,
                id,
                data: {
                    ...entity,
                    ...(visibility ? { visibility } : {}),
                    ...(ownerId !== undefined ? { ownerId } : {}),
                    ...(editors !== undefined ? { editors } : {}),
                    ...(viewers !== undefined ? { viewers } : {}),
                } as T,
            };
        } catch (error) {
            return { ok: false, error: String(error) };
        }
    }

    /**
     * Saves or updates an entity — each save is a new incarnation, a new GUID in the branching tree.
     * The old incarnation remains in the deep, preserved like a barnacled wreck.
     * If the ancestor be not the latest of its lineage, a branch is born — the tree forks in the dark.
     */
    async save(input: IUpdateInput): Promise<IControllerResponse<T>> {
        try {
            if (!input.id) {
                return { ok: false, error: 'id is required for save operation' };
            }

            // The new incarnation's GUID — unique across all realms.
            const saveId = this.enableVersioning ? generateVersionId() : input.id;

            // Resolve the ancestor row. `input.id` may be a version-GUID OR a lineageId;
            // findLatestVersionsByType handles both: exact-id match first, then lineageId-latest.
            // store.load() can't do that (it's findUnique-by-id only), so calling save with a
            // lineageId via that path would orphan the new version into a fresh lineage.
            // Carrion left in the deep: that legacy bug haunted grant_access on nodes.
            const existingRow = (await this.store.findLatestVersionsByType(this.entityType, [input.id]))[0] as any;
            let existingInner: Record<string, any> | null = null;
            let existingLineageId: string | undefined;
            let existingDisplayName: string | undefined;
            let existingType: string = this.entityType;

            if (existingRow) {
                const innerRaw = existingRow.serializedDogConfig;
                if (innerRaw !== undefined && innerRaw !== null) {
                    existingInner = typeof innerRaw === 'string' ? JSON.parse(innerRaw) : innerRaw;
                } else {
                    // Legacy rows without serializedDogConfig — treat the row itself as the cfg.
                    existingInner = existingRow;
                }
                existingLineageId = existingRow.lineageId || existingInner?.lineageId;
                existingDisplayName = existingRow.displayName || existingInner?.displayName;
                if (existingInner?.imitates) existingType = 'MimicDog';
            }

            // Inherit the lineage mark from the ancestor, or forge a new one fer an orphan.
            const lineageId = input.lineageId || existingLineageId || generateLineageId();
            // parentId must point to the actual previous version-GUID — never to the lineageId
            // (which is what input.id would be when the caller passes a lineage-style reference).
            const parentId = this.enableVersioning ? (existingRow?.id ?? input.id) : null;
            const displayName = input.displayName || existingDisplayName || input.id;

            // Resolve ACL fields BEFORE the change-detection so they participate in it.
            const inputVisibility = (input as any).visibility;
            const inputOwnerId = (input as any).ownerId;
            const inputEditors = (input as any).editors;
            const inputViewers = (input as any).viewers;
            const nextVisibility = inputVisibility === 'public' || inputVisibility === 'private'
                ? inputVisibility
                : existingRow?.visibility ?? undefined;
            const nextOwnerId = inputOwnerId !== undefined
                ? inputOwnerId
                : existingRow?.ownerId ?? undefined;
            const nextEditors = inputEditors !== undefined
                ? inputEditors
                : existingRow?.editors ?? undefined;
            const nextViewers = inputViewers !== undefined
                ? inputViewers
                : existingRow?.viewers ?? undefined;
            const visibilityChanged = (existingRow?.visibility ?? undefined) !== nextVisibility;
            const ownerChanged = (existingRow?.ownerId ?? undefined) !== nextOwnerId;
            const editorsChanged = JSON.stringify(existingRow?.editors ?? null) !== JSON.stringify(nextEditors ?? null);
            const viewersChanged = JSON.stringify(existingRow?.viewers ?? null) !== JSON.stringify(nextViewers ?? null);

            // Strip envelope-only fields before merging into the inner cfg, otherwise they
            // land in serializedDogConfig as duplicates of the row columns.
            const { id: _oldId, visibility: _vIn, ownerId: _oIn, editors: _eIn, viewers: _wIn, ...inputCfgFields } = (input as any);
            const { id: _prevId, serializedDogConfig: _stripNested, ...priorCfg } = (existingInner || {}) as any;
            const nextCfg = {
                ...priorCfg,
                ...inputCfgFields,
                id: saveId,
                lineageId,
                parentId,
                displayName,
            } as T;

            // If nothing has changed (cfg, visibility, ownership, editors, viewers), spare the deep.
            if (
                existingInner &&
                this.enableVersioning &&
                !this.hasContentChanged(existingInner as T, nextCfg) &&
                !visibilityChanged &&
                !ownerChanged &&
                !editorsChanged &&
                !viewersChanged
            ) {
                return {
                    ok: true,
                    id: (existingInner as any).id || input.id,
                    data: existingInner as T,
                };
            }

            // Resolve the final type: the new incarnation's imitates field takes precedence over the ancestor's.
            const resolvedType = (nextCfg as any).imitates ? 'MimicDog' : existingType;

            // Seal the merged entity in the store — only the cfg lives in serializedDogConfig,
            // never the Store envelope itself.
            await this.store.save({
                id: saveId,
                type: resolvedType,
                lineageId,
                parentId,
                displayName,
                serializedDogConfig: JSON.stringify(nextCfg),
                ...(nextVisibility !== undefined ? { visibility: nextVisibility } : {}),
                ...(nextOwnerId !== undefined ? { ownerId: nextOwnerId } : {}),
                ...(nextEditors !== undefined ? { editors: nextEditors } : {}),
                ...(nextViewers !== undefined ? { viewers: nextViewers } : {}),
                createdAt: new Date(),
            });

            return {
                ok: true,
                id: saveId,
                data: {
                    ...nextCfg,
                    ...(nextVisibility !== undefined ? { visibility: nextVisibility } : {}),
                    ...(nextOwnerId !== undefined ? { ownerId: nextOwnerId } : {}),
                    ...(nextEditors !== undefined ? { editors: nextEditors } : {}),
                    ...(nextViewers !== undefined ? { viewers: nextViewers } : {}),
                } as T,
            };
        } catch (error) {
            return { ok: false, error: String(error) };
        }
    }

    /**
     * Override getById so visibility + ownerId from the outer row land on the parsed entity.
     * The base AbstractController.getById passes data through parseEntity which only sees
     * serializedDogConfig; the outer row's visibility/ownerId are lost. We use
     * findLatestVersionsByType (which returns the full row) and graft the metadata back on.
     */
    async getById(id: string): Promise<IControllerResponse<T | null>> {
        try {
            const rows = await this.store.findLatestVersionsByType(this.entityType, [id]);
            if (rows.length === 0) {
                return { ok: false, error: `Entity mit ID ${id} nicht gefunden`, data: null };
            }
            const r: any = rows[0];
            const parsed = this.parseEntity(r.serializedDogConfig || r);
            if (r.id) (parsed as any).id = r.id;
            if (r.lineageId) (parsed as any).lineageId = r.lineageId;
            if (r.displayName) (parsed as any).displayName = r.displayName;
            if (r.visibility !== undefined && r.visibility !== null) (parsed as any).visibility = r.visibility;
            if (r.ownerId !== undefined && r.ownerId !== null) (parsed as any).ownerId = r.ownerId;
            if (r.editors !== undefined && r.editors !== null) (parsed as any).editors = r.editors;
            if (r.viewers !== undefined && r.viewers !== null) (parsed as any).viewers = r.viewers;
            return { ok: true, data: parsed };
        } catch (error) {
            return { ok: false, error: String(error), data: null };
        }
    }

    /**
     * Compare the soul of two incarnations — if the content be identical, no new version shall be born.
     * Only the fields that carry meaning are compared; metadata (id, lineageId, parentId, timestamps) is ignored.
     */
    private hasContentChanged(old: T, next: T): boolean {
        const contentKeys = ['theRun', 'tsCode', 'code', 'icon', 'parentsRequired', 'parentsOptional', 'imitates', 'displayName'];
        for (const key of contentKeys) {
            const a = (old as any)[key];
            const b = (next as any)[key];
            if (JSON.stringify(a) !== JSON.stringify(b)) return true;
        }
        return false;
    }
}
