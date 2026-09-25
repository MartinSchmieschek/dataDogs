// Waves-Redaktion — was der Aufrufer nicht lesen darf, verlaesst den Server nicht.
// Eine Definition, mehrere Leser: HTTP `/api/kennels/:id/run`, MCP `run_kennel`
// und die MCP-Snapshot-Werkzeuge. Weicht einer davon ab, ist das ein Leck.
import { SerializedDog, MimicDog } from '@slopdogs/core';
import type { IStore } from '../store/IStore';
import { canRead } from '../mcp/auth/visibility';
import type { NodeEntry, Waves } from './WavesConverter';

/** Platzhalter, der an die Stelle eines verweigerten Ergebnisses tritt. */
export const REDACTED_RESULT = '[redacted: not authorized to read this dog]';

/**
 * SECURITY (2026-09-13): strip the code and runtime internals of any wave node
 * the caller may NOT read. `/api/kennels/:id/run` returns the FULL waves — every
 * dog's tsCode, vmContext and result — and it gated only on the kennel's own
 * visibility. A public kennel may legitimately reference a PRIVATE node; before
 * this, an anonymous /run leaked that private node's source and data. Now each
 * SerializedDog/MimicDog node is checked against its own ACL; unreadable ones
 * keep only their identity + error, with code/context/result redacted. BaseDogs
 * (no lineageId, always public infrastructure) and nodes the caller can read are
 * untouched, so the owner's own /run and the UI waves-viewer are unaffected.
 *
 * Die Eingabe wird NICHT veraendert: redigierte Knoten sind Kopien, die Wellen
 * neue Arrays. Der Snapshot-Cache haelt rohe Waves fuer Leser mit verschiedenen
 * Rechten — jeder Leser bekommt seine Sicht, der Cache bleibt roh.
 */
export async function redactWavesForCtx(waves: Waves, reqCtx: any, nodesStore: IStore): Promise<Waves> {
    if (reqCtx?.isSuperUser) return waves;
    // Collect the identifiers of code-bearing nodes (SerializedDog/MimicDog).
    const ids = new Set<string>();
    for (const wave of waves) {
        for (const n of wave) {
            if (!n || !(n.editable || n.mimic)) continue; // base dogs are public infra
            if (n.lineageId) ids.add(n.lineageId);
            if (n.id) ids.add(n.id);
        }
    }
    if (ids.size === 0) return waves;

    const idList = Array.from(ids);
    const [serialized, mimics] = await Promise.all([
        nodesStore.findLatestVersionsByType(SerializedDog.name, idList),
        nodesStore.findLatestVersionsByType(MimicDog.name, idList),
    ]);
    const acl = new Map<string, any>();
    for (const row of [...serialized, ...mimics] as any[]) {
        const meta = {
            visibility: row.visibility,
            ownerId: row.ownerId,
            editors: row.editors,
            viewers: row.viewers,
        };
        if (row.lineageId) acl.set(String(row.lineageId), meta);
        if (row.id) acl.set(String(row.id), meta);
    }

    return waves.map((wave) => wave.map((n) => {
        if (!n || !(n.editable || n.mimic)) return n;
        const meta = acl.get(String(n.lineageId ?? '')) || acl.get(String(n.id ?? ''));
        // No ACL row found → fail-closed for a code-bearing node the caller
        // isn't the owner of. If a row exists, honour canRead.
        const readable = meta ? canRead(meta as any, reqCtx) : false;
        if (readable) return n;
        const redacted: NodeEntry = { ...n };
        redacted.codeTs = undefined;
        redacted.vmContext = undefined;
        redacted.vmContextTypeDef = undefined;
        redacted.vmExpectedReturnTypeName = undefined;
        redacted.serializedDogConfig = undefined;
        redacted.result = REDACTED_RESULT;
        (redacted as any).redacted = true;
        return redacted;
    }));
}
