// Shared tool types. Each tool has a JSON Schema for inputs (for MCP clients
// to introspect) and a handler that runs in the Express request context with
// access to the auth context.

import type { AuthCtx } from '../auth/middleware';
import type { KennelController } from '../../api/KennelController';
import type { Controller } from '../../api/Controller';
import type { KennelRunHandler } from '../../api/routes/KennelRunHandler';
import type { IStore } from '../../store/IStore';
import type { PrismaClient } from '../../store/generated/prisma-auth-client';

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
