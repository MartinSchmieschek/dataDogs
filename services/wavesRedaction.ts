// Waves-Redaktion — was der Aufrufer nicht lesen darf, verlaesst den Server nicht.
// Eine Definition, mehrere Leser: HTTP `/api/kennels/:id/run`, MCP `run_kennel`, die
// MCP-Snapshot-Werkzeuge und die Spec unter `/k/:id/openapi.json`. Weicht einer ab, ist das ein Leck.
//
// Zwei Stufen (P3.5 3.5.4, W17):
//   Kennel-RUN   canRun(kennel), !canRead(kennel) -> kennelRunView: Struktur, Lead-Result, Status;
//                keine Identitaet, kein Code, kein Kontext, kein Ergebnis je Dog.
//   Dog-Stufe    canRead(kennel)                  -> redactWavesForCtx je Dog:
//                READ alles | RUN Identitaet + result + error (gekuerzt), kein Code/Kontext |
//                NONE Identitaet + Schloss, result und error redigiert.
import { findLeadNodeEntry, type NodeEntry, type Waves } from './WavesConverter';
import type { IKennelConfig } from '@slopdogs/core';
import type { IStore } from '../store/IStore';
import { DogAclIndex } from './dogAccess';

/** Platzhalter, der an die Stelle eines verweigerten Ergebnisses tritt. */
export const REDACTED_RESULT = '[redacted: not authorized to read this dog]';

/** Platzhalter fuer Fehlertexte, die der Aufrufer nicht lesen darf (W13). */
export const REDACTED_TEXT = '[redacted]';

/** Laenge, auf die ein Dog-Fehler fuer RUN-Leser gekuerzt wird (W13). */
const RUN_ERROR_MAX = 200;

/**
 * Ein Fehlertext fuer jemanden ohne Code-Leserecht: erste Zeile, gekuerzt, nie ein Stack.
 * Der Stack traegt Zeilen und Dateinamen — die Struktur des Codes, den RUN nicht sehen darf.
 */
export function shortErrorText(error: unknown): string | undefined {
    if (error === undefined || error === null || error === '') return undefined;
    const first = String(error).split(/\r?\n/)[0].trim();
    return first.length > RUN_ERROR_MAX ? first.substring(0, RUN_ERROR_MAX) + '…' : first;
}

/**
 * SECURITY (2026-09-13, P3.5): strip the code and runtime internals of any wave node the
 * caller may NOT read. `/api/kennels/:id/run` returns the FULL waves — every dog's tsCode,
 * vmContext and result. Each SerializedDog/MimicDog node is checked against the ACL of its
 * lineage HEAD: READ keeps everything; RUN keeps identity, result and a shortened error;
 * NONE keeps identity only (result and error redacted). BaseDogs (no lineageId, always
 * public infrastructure) are untouched, so the owner's own /run and the waves-viewer are
 * unaffected.
 *
 * Die Eingabe wird NICHT veraendert: redigierte Knoten sind Kopien, die Wellen neue Arrays.
 */
export async function redactWavesForCtx(waves: Waves, reqCtx: any, nodesStore: IStore): Promise<Waves> {
    if (reqCtx?.isSuperUser) return waves;
    const refs = waves.flat().filter((n) => n && (n.editable || n.mimic)).map((n) => ({ id: n.id, lineageId: n.lineageId }));
    if (refs.length === 0) return waves;
    const index = await DogAclIndex.load(nodesStore, refs);

    return waves.map((wave) => wave.map((n) => {
        if (!n || !(n.editable || n.mimic)) return n; // base dogs are public infra
        const access = index.accessOf({ id: n.id, lineageId: n.lineageId }, reqCtx);
        if (access === 'read') return n;
        const redacted: NodeEntry = { ...n };
        redacted.codeTs = undefined;
        redacted.vmContext = undefined;
        redacted.vmContextTypeDef = undefined;
        redacted.vmExpectedReturnTypeName = undefined;
        redacted.serializedDogConfig = undefined;
        // Was dieser Code gelesen hat, ist die Struktur des Codes.
        redacted.readFrom = undefined;
        if (access === 'run') {
            redacted.error = shortErrorText(n.error);
        } else {
            redacted.result = REDACTED_RESULT;
            redacted.error = n.error ? REDACTED_TEXT : undefined;
        }
        (redacted as any).redacted = true;
        (redacted as any).access = access;
        return redacted;
    }));
}

/** Was ein Kennel-RUN-Leser von einem Lauf sieht (W17 Stufe 1). */
export interface KennelRunView {
    ok: true;
    waves: Array<{ dogCount: number }>;
    leadResult: unknown;
    durationMs: number;
    dogs: Array<{ status: 'ok' | 'failed' }>;
}

/**
 * Kennel-Stufe RUN: nur die Form des Laufs. Dog-Namen wie `StripeWebhookSigner` verraten
 * Architektur (Follie 7.6) — also keine id, kein Name, kein Icon, kein Ergebnis je Dog, kein
 * Fehlertext; nur das Lead-Ergebnis, das `/k/:id` ohnehin liefert.
 */
export function kennelRunView(waves: Waves, config: IKennelConfig, durationMs: number): KennelRunView {
    return {
        ok: true,
        waves: waves.map((wave) => ({ dogCount: wave.length })),
        leadResult: findLeadNodeEntry(waves, config)?.result,
        durationMs,
        dogs: waves.flat().map((n) => ({ status: n.error ? 'failed' : 'ok' })),
    };
}
