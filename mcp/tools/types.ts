// Shared tool types. Each tool has a JSON Schema for inputs (for MCP clients
// to introspect) and a handler that runs in the Express request context with
// access to the auth context.

import type { AuthCtx } from '../auth/middleware';
import type { KennelController } from '../../api/KennelController';
import type { Controller } from '../../api/Controller';
import type { KennelRunHandler } from '../../api/routes/KennelRunHandler';
import type { IStore } from '../../store/IStore';
import type { PrismaClient } from '../../store/generated/prisma-auth-client';
import type { KennelSnapshotCache } from '../snapshots/KennelSnapshotCache';

export interface BaseDogInfo {
    id: string;
    name: string;
    description: string;
    type: 'BaseDog';
    icon?: string;
    /**
     * Class names this dog needs / can use. Exactly the syntax build_kennel expects in
     * `dogs[].parentsRequired` / `parentsOptional` (bare names, no `base:` prefix).
     * Without these an agent can list the pack but never wire it.
     */
    parentsRequired?: string[];
    parentsOptional?: string[];
    /** True when this entry is a Pact -- a contract a MimicDog or a providing dog must fulfil. */
    isPact?: boolean;
    /** For Pacts: the demanded shape, when the pact declares one. */
    pactTypeDef?: string;
    /**
     * Binding instruction straight from the dog class (`static mcpGuidance`). Present only for
     * infrastructure dogs an agent must NOT re-implement — it travels with the dog so it cannot
     * drift out of sync with a separate document.
     */
    guidance?: string;
}

export interface ToolDeps {
    kennelsController: KennelController;
    nodesController: Controller<any>;
    kennelRunHandler: KennelRunHandler;
    /** Direct store access for ACL helpers (canMutateNode, etc.). */
    kennelsStore: IStore;
    nodesStore: IStore;
    /** Used by ACL tools to resolve user emails -> user IDs. */
    prisma: PrismaClient;
    baseDogsList: BaseDogInfo[];
    projectRoot: string;
    /** In-memory snapshot store for the inspection tools. Created inside createMcpRouter. */
    snapshotCache: KennelSnapshotCache;
}

export interface ToolResult {
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
}

export interface ToolDef {
    name: string;
    description: string;
    inputSchema: Record<string, any>; // JSON Schema (object)
    handler: (args: Record<string, any>, ctx: AuthCtx, deps: ToolDeps) => Promise<ToolResult>;
}

export function ok(payload: unknown): ToolResult {
    return {
        content: [
            {
                type: 'text',
                text: typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2),
            },
        ],
    };
}

export function fail(message: string): ToolResult {
    return {
        content: [{ type: 'text', text: message }],
        isError: true,
    };
}

/**
 * Resolve tsCode-or-tsCodeBase64 into the raw TypeScript source string.
 *
 * Welle 11: many MCP clients have to escape backticks, newlines, quotes and
 * template literals into a JSON string. PowerShell's ConvertTo-Json mangles
 * common dog-code shapes; long template literals turn quoting into a horror.
 * The base64 alternative lets a client pass `Buffer.from(tsCode).toString('base64')`
 * and skip the escape gauntlet entirely.
 *
 * Contract:
 * - Provide exactly one of `tsCode` (raw string) or `tsCodeBase64` (utf8-encoded base64).
 * - Both → error.
 * - Neither → error (when tsCode is required by the tool).
 */
/**
 * Waechter gegen die zwei Selbstbau-Fallen. Bewusst SEHR eng gefasst — eine Warnung, die
 * auf korrektem Code losgeht, bringt nur bei, Warnungen zu ignorieren.
 *
 * Der Renderer-Dog DARF `new WebSocket(wsUrl)` in das HTML schreiben, das er ausliefert —
 * die Seite im Browser muss den Socket ja oeffnen. Falsch ist es erst, wenn dabei KEIN
 * WebSocketChannelRetriever verdrahtet ist: dann hat sich der Agent seine eigene Lobby
 * gebaut, statt die vorhandene zu nehmen. Genau darauf und auf nichts anderes wird geprueft.
 */
export function codeHinweise(
    tsCode: unknown,
    parents: { parentsRequired?: unknown; parentsOptional?: unknown },
): string[] {
    if (typeof tsCode !== 'string' || tsCode.length === 0) return [];
    const out: string[] = [];

    const parentNames = [
        ...(Array.isArray(parents.parentsRequired) ? parents.parentsRequired : []),
        ...(Array.isArray(parents.parentsOptional) ? parents.parentsOptional : []),
    ]
        .filter((p): p is string => typeof p === 'string')
        .map((p) => p.replace(/^base:/, '').replace(/^@/, ''));
    const hasLobby = parentNames.includes('WebSocketChannelRetriever');

    const usesSocket = /new\s+WebSocket\s*\(/.test(tsCode) || /\bwss?:\/\//.test(tsCode);
    if (usesSocket && !hasLobby) {
        out.push(
            'Dieser Dog benutzt einen WebSocket, hat aber keinen WebSocketChannelRetriever als Parent — '
            + 'du baust dir gerade eine eigene Lobby. Nimm die vorhandene: '
            + 'extraDogIds: ["base:WebSocketChannelRetriever"] (MIT base:) und '
            + 'parentsRequired: ["WebSocketChannelRetriever"] (OHNE base:). '
            + 'Sie liefert channelId, wsUrl, heartbeatSec und peers — erfinde keine eigene Adresse und keinen eigenen room-Parameter. '
            + 'Den Teilen-Link baut die Seite selbst aus location.origin + location.pathname + "?channelId=" + channelId.',
        );
    }

    if (/require\s*\(\s*['"]fs['"]\s*\)/.test(tsCode) || /\bfs\.(writeFile|readFile|appendFile)/.test(tsCode)) {
        out.push(
            'Dateisystem-Zugriff im Dog-Code — der VM-Sandkasten hat keins. '
            + 'Fuer Zustand und Caches steht `jsonStore` global bereit (get/set/delete/has/list/snapshot, alle async).',
        );
    }

    return out;
}

export function resolveTsCode(args: { tsCode?: unknown; tsCodeBase64?: unknown }): string {
    const hasRaw = typeof args.tsCode === 'string';
    const hasB64 = typeof args.tsCodeBase64 === 'string';
    if (hasRaw && hasB64) {
        throw new Error('Provide either tsCode or tsCodeBase64, not both');
    }
    if (hasB64) {
        try {
            return Buffer.from(args.tsCodeBase64 as string, 'base64').toString('utf8');
        } catch (e: any) {
            throw new Error('tsCodeBase64 decode failed: ' + (e?.message ?? String(e)));
        }
    }
    if (hasRaw) return args.tsCode as string;
    throw new Error('tsCode or tsCodeBase64 required');
}
