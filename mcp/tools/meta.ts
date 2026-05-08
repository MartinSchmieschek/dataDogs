// Meta tools — README and health.
// get_readme returns the canonical README that describes the kennel-building workflow,
// the available pacts, the API surface. Use this to ground yourself before issuing
// commands; the README is the source of truth.

import { promises as fs } from 'fs';
import path from 'path';
import { type ToolDef, ok, fail } from './types';

export function getMetaTools(): ToolDef[] {
    return [
        {
            name: 'get_readme',
            description:
                'Returns the dataDogs README — the living document of the API, architecture, and conventions. Read this once at session start; it is the truth that other tool descriptions assume.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            handler: async (_args, _ctx, deps) => {
                const candidates = [
                    path.join(deps.projectRoot, 'README.md'),
                    path.join(deps.projectRoot, '..', 'README.md'),
                ];
                for (const p of candidates) {
                    try {
                        const text = await fs.readFile(p, 'utf-8');
                        return ok(text);
                    } catch { /* try next */ }
                }
                return fail('README.md not found');
            },
        },
        {
            name: 'health_check',
            description: 'Cheap liveness probe. Returns the current server time and authenticated user (if any).',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            handler: async (_args, ctx) => {
                return ok({
                    ok: true,
                    serverTime: new Date().toISOString(),
                    user: ctx.user ? { id: ctx.user.id, email: ctx.user.email } : null,
                    isSuperUser: ctx.isSuperUser,
                });
            },
        },
    ];
}
