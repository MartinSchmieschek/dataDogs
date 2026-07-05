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
