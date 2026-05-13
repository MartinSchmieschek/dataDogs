// Streamable HTTP MCP transport at POST /mcp.
//
// Stateless mode: every POST creates a fresh Server + Transport, processes one
// JSON-RPC request, responds, and tears down. No session handshake, no SSE
// long-poll. Works for Claude.ai Connectors, Cursor, Claude Desktop/Code, and
// the OpenAI Responses API's "mcp" tool type.

import { Router, type Request, type Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getKennelTools } from '../tools/kennels';
import { getNodeTools } from '../tools/nodes';
import { getMetaTools } from '../tools/meta';
import { getAclTools } from '../tools/acl';
import { getSnapshotTools } from '../tools/snapshots';
import { type ToolDeps, type ToolDef } from '../tools/types';
import type { AuthCtx } from '../auth/middleware';

let cachedSkill: string | null = null;

async function loadSkill(projectRoot: string): Promise<string> {
    if (cachedSkill !== null) return cachedSkill;
    const candidates = [
        path.join(projectRoot, 'mcp', 'skill.md'),
        path.join(projectRoot, '..', 'mcp', 'skill.md'),
    ];
    for (const p of candidates) {
        try {
            cachedSkill = await fs.readFile(p, 'utf-8');
            return cachedSkill;
        } catch { /* try next */ }
    }
    cachedSkill = '';
    return cachedSkill;
}

function buildServer(tools: ToolDef[], ctx: AuthCtx, deps: ToolDeps, instructions: string): Server {
    const toolMap = new Map(tools.map((t) => [t.name, t]));
    const server = new Server(
        { name: 'datadogs', version: '0.1.0' },
        {
            capabilities: { tools: {} },
            instructions,
        },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema as any,
        })),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (req): Promise<any> => {
        const tool = toolMap.get(req.params.name);
        if (!tool) {
            return {
                content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }],
                isError: true,
            };
        }
        try {
            return await tool.handler(req.params.arguments ?? {}, ctx, deps);
        } catch (err: any) {
            return {
                content: [{ type: 'text', text: `Tool ${tool.name} failed: ${err?.message ?? err}` }],
                isError: true,
            };
        }
    });

    return server;
}

/**
 * createMcpRouter is invoked once at startup. The snapshotCache comes from
 * the caller (main.ts) so MCP and the OpenAPI Actions transport observe the
 * same void memory.
 */
export function createMcpRouter(deps: ToolDeps): Router {
    const router = Router();
    const tools: ToolDef[] = [
        ...getKennelTools(),
        ...getNodeTools(),
        ...getSnapshotTools(),
        ...getAclTools(),
        ...getMetaTools(),
    ];

    router.post('/', async (req: Request, res: Response) => {
        const ctx = req.ctx;
        if (!ctx) {
            res.status(500).json({ error: 'no auth context — middleware misordered' });
            return;
        }
        if (!ctx.user && !ctx.isSuperUser) {
            const base = process.env.MCP_BASE_URL || `${req.protocol}://${req.get('host')}`;
            res.setHeader(
                'WWW-Authenticate',
                `Bearer realm="dataDogs MCP", resource_metadata="${base}/.well-known/oauth-protected-resource"`,
            );
            res.status(401).json({
                error: 'unauthorized',
                error_description: 'Bearer token required. Discover OAuth at /.well-known/oauth-authorization-server.',
            });
            return;
        }

        const instructions = await loadSkill(deps.projectRoot);
        const server = buildServer(tools, ctx, deps, instructions);
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined, // stateless
        });
        res.on('close', () => {
            void transport.close();
            void server.close();
        });
        try {
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
        } catch (err: any) {
            console.error('[mcp] handleRequest', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'mcp internal', message: err?.message ?? String(err) });
            }
        }
    });

    // GET /mcp would be SSE long-polling for stateful sessions — not used in stateless mode.
    router.get('/', (_req: Request, res: Response) => {
        res.set('Allow', 'POST').status(405).json({
            error: 'method_not_allowed',
            error_description: 'POST /mcp with a JSON-RPC body. This server runs in stateless mode.',
        });
    });

    return router;
}
