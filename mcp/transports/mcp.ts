// Streamable HTTP MCP transport at POST /mcp.
//
// Stateless mode: every POST creates a fresh Server + Transport, processes one
// JSON-RPC request, responds, and tears down. No session handshake, no SSE
// long-poll. Works for Claude.ai Connectors, Cursor, Claude Desktop/Code, and
// the OpenAI Responses API's "mcp" tool type.

import { Router, type Request, type Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { promises as fs } from 'fs';
import path from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getKennelTools } from '../tools/kennels';
import { getNodeTools } from '../tools/nodes';
import { getMetaTools, setMetaToolRegistry } from '../tools/meta';
import { getAclTools } from '../tools/acl';
import { getSnapshotTools } from '../tools/snapshots';
import { type ToolDeps, type ToolDef } from '../tools/types';
import type { AuthCtx } from '../auth/middleware';
import { buildMcpInitializeInstructions } from '../spuren-brief';

/**
 * Welle 11: tools/list token diet. The full long-form description is kept on
 * the ToolDef and reachable via describe_tool(name); tools/list ships only a
 * one-liner so a session handshake doesn't burn 5-10k tokens on description text.
 *
 * Strategy: first sentence (cut at ".", "!" or "?" followed by whitespace) up to
 * 120 chars, else a hard 140-char clip with ellipsis.
 */
function shortDescription(d: string): string {
    if (!d) return '';
    const m = d.match(/^([\s\S]{1,120}?[.!?])\s/);
    if (m) return m[1];
    return d.length > 140 ? d.slice(0, 137) + '...' : d;
}

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

/** Stable URI fer the skill resource -- MCP-Clients addressieren es so. */
const SKILL_RESOURCE_URI = 'datadogs://skill';

function buildServer(
    tools: ToolDef[],
    ctx: AuthCtx,
    deps: ToolDeps,
    skillContent: string,
): Server {
    const toolMap = new Map(tools.map((t) => [t.name, t]));
    // Welle 8 (P6): skill.md zusaetzlich als MCP-Resource exponieren. Wir behalten
    // die kurze `instructions`-Variante fuer MCP-Clients ohne Resource-Support;
    // der volle Inhalt ist ueber Resource `datadogs://skill` abrufbar.
    const shortInstructions = buildMcpInitializeInstructions(Boolean(skillContent));
    const server = new Server(
        { name: 'datadogs', version: '0.2.0-beta.0' },
        {
            capabilities: { tools: {}, resources: {} },
            instructions: shortInstructions,
        },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: tools.map((t) => ({
            name: t.name,
            description: shortDescription(t.description),
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

    // Resources: skill.md -- Clients koennen den vollen Skill-Guide lesen,
    // ohne dass er als (gekuerzte) `instructions` im Connection-Handshake landet.
    server.setRequestHandler(ListResourcesRequestSchema, async () => ({
        resources: [
            {
                uri: SKILL_RESOURCE_URI,
                name: 'Skill: dataDogs MCP usage guide',
                description: 'Vollstaendiger Voidtongue/Pirate-Brief mit Tool-Workflows, Sandbox-Grenzen und Stale-Snapshot-Konventionen.',
                mimeType: 'text/markdown',
            },
        ],
    }));

    server.setRequestHandler(ReadResourceRequestSchema, async (req): Promise<any> => {
        const uri = req.params.uri;
        if (uri !== SKILL_RESOURCE_URI) {
            // Unknown resource -- MCP SDK turns thrown errors into proper JSON-RPC errors.
            throw new Error(`Unknown resource: ${uri}`);
        }
        return {
            contents: [
                {
                    uri,
                    mimeType: 'text/markdown',
                    text: skillContent,
                },
            ],
        };
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
    // Wire the registry into the meta module so describe_tool can resolve names
    // back to their full long-form description + schema (Welle 11 token diet).
    setMetaToolRegistry(tools);

    // Rate limit -- pro Identity (User-Id, sonst IP, sonst 'anon').
    // Default 120/min, env-override per `DATADOGS_MCP_RATE_LIMIT`.
    const rateLimitMax = (() => {
        const raw = Number(process.env.DATADOGS_MCP_RATE_LIMIT);
        return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 120;
    })();
    const mcpLimiter = rateLimit({
        windowMs: 60 * 1000,
        limit: rateLimitMax,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        keyGenerator: (req: Request) => {
            if (req.ctx?.user?.id) return req.ctx.user.id;
            if (req.ip) return ipKeyGenerator(req.ip);
            return 'anon';
        },
        message: {
            error: 'rate_limit_exceeded',
            error_description: `Too many MCP calls -- max ${rateLimitMax}/min per identity.`,
        },
    });

    router.post('/', mcpLimiter, async (req: Request, res: Response) => {
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

        const skillContent = await loadSkill(deps.projectRoot);
        const server = buildServer(tools, ctx, deps, skillContent);
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
