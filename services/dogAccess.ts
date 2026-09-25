// Dog-Zugriff im Lauf — wer darf welchen Dog ausfuehren, und mit wessen Kapazitaeten?
// Eine Definition fuer den Lauf (KennelRunHandler) und die Redaktion (wavesRedaction):
// die Rechte eines Dogs sind die seines Lineage-Kopfes, nie die einer gepinnten alten Version.
import {
    SerializedDog,
    MimicDog,
    type IKennelConfig,
    type IMimicDogConfig,
    type ISerializedDogConfig,
    type VmGlobalCapabilityContext,
} from '@slopdogs/core';
import type { IStore } from '../store/IStore';
import type { AuthCtx } from '../mcp/auth/middleware';
import { accessOf, aclOf, canRead, canRun, parseList, type Access, type AclEntity } from '../mcp/auth/visibility';

/** Ein Verweis auf einen Dog: Version-GUID und/oder lineageId. */
export interface DogRef {
    id?: string | null;
    lineageId?: string | null;
}

/**
 * Die Rechte der Dogs eines Laufs, aufgeloest auf den Kopf ihrer Lineage. Ein Dog, dessen Zeile
 * fehlt, hat keine Rechte — fail-closed ({@link accessOf} liefert dann 'none').
 */
export class DogAclIndex {
    private constructor(private readonly byKey: Map<string, AclEntity>) {}

    /**
     * Zwei Wege je Typ: Refs mit lineageId holen den Kopf ihrer Lineage, Refs ohne (Altbestand)
     * ihre eigene Zeile. Ohne Refs keine Abfrage.
     */
    static async load(nodesStore: IStore, refs: DogRef[]): Promise<DogAclIndex> {
        const lineageIds = [...new Set(refs.map((r) => r.lineageId).filter((v): v is string => !!v))];
        const bareIds = [...new Set(refs.filter((r) => !r.lineageId && r.id).map((r) => String(r.id)))];
        const byKey = new Map<string, AclEntity>();
        for (const ids of [lineageIds, bareIds]) {
            if (ids.length === 0) continue;
            const [serialized, mimics] = await Promise.all([
                nodesStore.findLatestVersionsByType(SerializedDog.name, ids),
                nodesStore.findLatestVersionsByType(MimicDog.name, ids),
            ]);
            for (const row of [...serialized, ...mimics] as any[]) {
                const key = ids === lineageIds ? row.lineageId : row.id;
                if (key && ids.includes(String(key))) byKey.set(String(key), aclOf(row));
            }
        }
        return new DogAclIndex(byKey);
    }

    aclOf(ref: DogRef): AclEntity | undefined {
        return (ref.lineageId && this.byKey.get(String(ref.lineageId))) || (ref.id ? this.byKey.get(String(ref.id)) : undefined);
    }

    accessOf(ref: DogRef, ctx: AuthCtx | undefined): Access {
        if (ctx?.isSuperUser) return 'read';
        const acl = this.aclOf(ref);
        return acl ? accessOf(acl, ctx) : 'none';
    }
}

/** Der Laufzeit-Kontext eines Laufs, als AuthCtx gelesen — fuer die Praedikate in visibility.ts. */
function authOfCapability(ctx: VmGlobalCapabilityContext | undefined): AuthCtx | undefined {
    if (!ctx) return undefined;
    return {
        user: ctx.userId ? { id: ctx.userId, email: '', name: null } : null,
        isSuperUser: ctx.isSuperUser === true,
    };
}

/**
 * Welche Dogs laufen in einem Kennel, und mit welchen Kapazitaeten (P3.5 3.5.4, 3.5.7, 8.15)?
 *
 * 1. Ausfuehren darf ein Dog, wenn der Kennel ihn tragen darf: er gehoert dem Kennel-Owner oder
 *    einem Kennel-Editor (dieselbe Hand hat ihn eingesetzt), oder der Kennel-Owner darf ihn
 *    ausfuehren (canRun — oeffentlich, run-only, oder er steht in runners). Sonst fehlt der Dog
 *    im Lauf: ein fremder privater Dog im Altbestand laeuft nicht, auch wenn der Aufrufer ihn
 *    zufaellig lesen duerfte — der Lauf eines Kennels haengt nicht davon ab, wer ihn ansieht.
 * 2. Darf der AUFRUFER den Dog nicht lesen, laeuft er in einem eigenen Namensraum: jsonStore unter
 *    `user:<aufrufer>:dog:<lineage>:` statt `user:<aufrufer>:`. Fremder Code sieht so nie die Ablage
 *    (und spaeter die Keys) dessen, der ihn ausfuehrt. Anonyme Aufrufer teilen sich ohnehin `anon:`.
 */
export class DogRunPolicy {
    private readonly kennelOwnerId: string | null;
    private readonly kennelHands: Set<string>;
    private readonly kennelOwnerCtx: AuthCtx;
    private readonly runnerCtx: AuthCtx | undefined;

    constructor(kennel: IKennelConfig, private readonly capabilityCtx: VmGlobalCapabilityContext | undefined) {
        this.kennelOwnerId = (kennel as any).ownerId ?? null;
        this.kennelHands = new Set([
            ...(this.kennelOwnerId ? [this.kennelOwnerId] : []),
            ...parseList((kennel as any).editors),
        ]);
        this.kennelOwnerCtx = {
            user: this.kennelOwnerId ? { id: this.kennelOwnerId, email: '', name: null } : null,
            isSuperUser: false,
        };
        this.runnerCtx = authOfCapability(capabilityCtx);
    }

    /** Darf dieser Dog in diesem Kennel ueberhaupt laufen? */
    mayRun(dog: AclEntity | undefined): boolean {
        if (!dog) return false;
        const dogOwnerId = dog.ownerId ?? null;
        if (dogOwnerId === this.kennelOwnerId) return true;
        if (dogOwnerId && this.kennelHands.has(dogOwnerId)) return true;
        return canRun(dog, this.kennelOwnerCtx);
    }

    /** Laeuft er im eigenen Namensraum? Ja, wenn der Aufrufer seinen Code nicht lesen darf. */
    isForeignToRunner(dog: AclEntity): boolean {
        if (!this.runnerCtx || this.runnerCtx.isSuperUser) return false;
        return !canRead(dog, this.runnerCtx);
    }

    /** Die Instanz fuer den Lauf — im eigenen Namensraum, wenn sie dem Aufrufer fremd ist. */
    instantiate(config: ISerializedDogConfig | IMimicDogConfig, storageId: string, dog: AclEntity, lineageId: string): SerializedDog<unknown> {
        const imitates = (config as IMimicDogConfig).imitates;
        const isMimic = typeof imitates === 'string' && imitates.length > 0;
        if (!this.isForeignToRunner(dog)) {
            return isMimic ? new MimicDog(config as IMimicDogConfig, storageId) : new SerializedDog(config, storageId);
        }
        return isMimic
            ? new RunnerScopedMimicDog(config as IMimicDogConfig, storageId, lineageId)
            : new RunnerScopedSerializedDog(config, storageId, lineageId);
    }
}

/**
 * Der Kapazitaets-Kontext eines fremden Dogs: die userId wird zu `<user>:dog:<lineage>`. Jede
 * Kapazitaet, die nach userId trennt (jsonStore heute, Keys in P4c), sieht damit einen eigenen,
 * leeren Namensraum statt der Ablage des Aufrufers — fail-closed, auch fuer kuenftige Kapazitaeten.
 */
export function scopeCapabilityToDog(
    ctx: VmGlobalCapabilityContext | undefined,
    lineageId: string,
): VmGlobalCapabilityContext | undefined {
    if (!ctx || ctx.isSuperUser || !ctx.userId) return ctx;
    return { ...ctx, userId: `${ctx.userId}:dog:${lineageId}` };
}

/** Ein SerializedDog, der dem Aufrufer fremd ist: gleicher Code, eigener Namensraum. */
export class RunnerScopedSerializedDog<T> extends SerializedDog<T> {
    constructor(config: ISerializedDogConfig, storageId: string, private readonly scopeLineageId: string) {
        super(config, storageId);
    }

    public setCapabilityContext(ctx: VmGlobalCapabilityContext | undefined): void {
        super.setCapabilityContext(scopeCapabilityToDog(ctx, this.scopeLineageId));
    }
}

/** Dasselbe fuer einen MimicDog. */
export class RunnerScopedMimicDog<T> extends MimicDog<T> {
    constructor(config: IMimicDogConfig, storageId: string, private readonly scopeLineageId: string) {
        super(config, storageId);
    }

    public setCapabilityContext(ctx: VmGlobalCapabilityContext | undefined): void {
        super.setCapabilityContext(scopeCapabilityToDog(ctx, this.scopeLineageId));
    }
}
