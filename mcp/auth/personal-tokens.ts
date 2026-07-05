// Personal Access Tokens — long-lived Bearer tokens issued via the browser to
// the logged-in user. For configs where the full OAuth dance is overkill (e.g.
// pasting a token into Cursor's MCP config or a Custom GPT's API Key field).
//
//   GET    /auth/tokens          HTML management page
//   POST   /auth/tokens          create new PAT (form post; renders the token once)
//   POST   /auth/tokens/:jti/revoke   revoke
//
// PATs are AccessToken rows with clientId = 'pat'. No refresh token; lifetime 1 year.

import { Router, type Request, type Response } from 'express';
import type { PrismaClient } from '../../store/generated/prisma-auth-client';
import { issueAccessToken } from './jwt';
import { paramString } from '../../api/utils/routeParams';

const PAT_CLIENT_ID = 'pat';
const PAT_TTL_SEC = 60 * 60 * 24 * 365; // 1 year

function requireSession(req: Request, res: Response): string | null {
    const uid = req.session?.userId;
    if (!uid) {
        res.status(401).send(notLoggedInPage());
        return null;
    }
    return uid;
}

export function createPersonalTokensRouter(prisma: PrismaClient): Router {
    const router = Router();

    router.get('/', async (req: Request, res: Response) => {
        const userId = requireSession(req, res);
        if (!userId) return;

        const tokens = await prisma.accessToken.findMany({
            where: { userId, clientId: PAT_CLIENT_ID },
            orderBy: { createdAt: 'desc' },
        });
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(renderListPage(tokens, null));
    });

    router.post('/', async (req: Request, res: Response) => {
        const userId = requireSession(req, res);
        if (!userId) return;

        const access = await issueAccessToken({
            userId,
            clientId: PAT_CLIENT_ID,
            scope: 'default',
            ttlSeconds: PAT_TTL_SEC,
        });
        await prisma.accessToken.create({
            data: {
                jti: access.jti,
                userId,
                clientId: PAT_CLIENT_ID,
                scope: 'default',
                expiresAt: access.expiresAt,
            },
        });

        const tokens = await prisma.accessToken.findMany({
            where: { userId, clientId: PAT_CLIENT_ID },
            orderBy: { createdAt: 'desc' },
        });
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(renderListPage(tokens, access.jwt));
    });

    router.post('/:jti/revoke', async (req: Request, res: Response) => {
        const userId = requireSession(req, res);
        if (!userId) return;

        await prisma.accessToken.updateMany({
            where: { jti: paramString(req.params.jti), userId, clientId: PAT_CLIENT_ID },
            data: { revokedAt: new Date() },
        });
        res.redirect('/auth/tokens');
    });

    return router;
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const PAGE_STYLES = `
body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  background:radial-gradient(circle at 30% 20%,#1a1a2e 0%,#0a0a14 60%);color:#e8e8f0;
  min-height:100vh;padding:24px;}
.wrap{max-width:760px;margin:0 auto;}
.card{background:rgba(26,26,46,.85);border:1px solid rgba(255,255,255,.08);
  border-radius:16px;padding:24px;margin-bottom:20px;backdrop-filter:blur(8px);}
h1{font-size:24px;margin:0 0 8px 0;}
p.lead{color:#a8a8c0;font-size:14px;margin:0 0 16px 0;line-height:1.5;}
.btn{border:none;border-radius:10px;padding:10px 16px;font-size:14px;
  font-weight:600;cursor:pointer;background:linear-gradient(135deg,#5b8def 0%,#3d6bff 100%);
  color:#fff;}
.btn:hover{filter:brightness(1.1);}
.btn-danger{background:rgba(220,80,80,.15);color:#ff9090;}
.btn-danger:hover{background:rgba(220,80,80,.25);}
.token-new{background:rgba(80,200,120,.1);border:1px solid rgba(80,200,120,.3);
  border-radius:10px;padding:14px;margin-bottom:16px;}
.token-new code{display:block;background:rgba(0,0,0,.4);padding:10px;border-radius:6px;
  font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;word-break:break-all;
  color:#9ee99e;margin-top:8px;}
.warn{color:#ffb070;font-size:13px;margin-top:8px;}
table{width:100%;border-collapse:collapse;margin-top:12px;}
th,td{padding:8px 10px;text-align:left;border-bottom:1px solid rgba(255,255,255,.06);
  font-size:13px;}
th{color:#a8a8c0;font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.5px;}
td.muted{color:#7878a0;}
td.id{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;color:#a0a0c0;}
.empty{color:#7878a0;font-style:italic;padding:16px;text-align:center;}
.pill{display:inline-block;padding:2px 8px;border-radius:6px;font-size:11px;}
.pill-ok{background:rgba(80,200,120,.15);color:#9ee99e;}
.pill-rev{background:rgba(220,80,80,.15);color:#ff9090;}
`;

function renderListPage(
    tokens: Array<{ jti: string; expiresAt: Date; revokedAt: Date | null; createdAt: Date }>,
    fresh: string | null,
): string {
    const rows = tokens.length === 0
        ? '<tr><td colspan="4" class="empty">No tokens yet — create one below.</td></tr>'
        : tokens.map((t) => {
            const status = t.revokedAt
                ? '<span class="pill pill-rev">revoked</span>'
                : t.expiresAt.getTime() < Date.now()
                ? '<span class="pill pill-rev">expired</span>'
                : '<span class="pill pill-ok">active</span>';
            return [
                '<tr>',
                `<td class="id">${escapeHtml(t.jti.slice(0, 8))}…</td>`,
                `<td>${status}</td>`,
                `<td class="muted">expires ${escapeHtml(t.expiresAt.toISOString().slice(0, 10))}</td>`,
                t.revokedAt
                    ? '<td></td>'
                    : `<td><form method="POST" action="/auth/tokens/${escapeHtml(t.jti)}/revoke" style="display:inline">`
                      + '<button class="btn btn-danger" type="submit">Revoke</button></form></td>',
                '</tr>',
            ].join('');
        }).join('');

    const freshBlock = fresh
        ? [
            '<div class="token-new">',
            '<strong>Your new token (copy now — you won\'t see it again):</strong>',
            `<code>${escapeHtml(fresh)}</code>`,
            '<div class="warn">Use as <code>Authorization: Bearer &lt;token&gt;</code> ',
            'in your MCP client config or Custom GPT API Key field.</div>',
            '</div>',
        ].join('')
        : '';

    return [
        '<!DOCTYPE html><html lang="en"><head>',
        '<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>',
        '<title>dataDogs — Personal Access Tokens</title>',
        `<style>${PAGE_STYLES}</style></head><body><div class="wrap">`,
        '<div class="card">',
        '<h1>Personal Access Tokens</h1>',
        '<p class="lead">Long-lived Bearer tokens for direct use in MCP client configs, ',
        'Custom GPT API Key fields, or scripts. The full OAuth dance is for clients that ',
        'auto-discover (Cursor, Claude.ai Connectors). This is the manual fast lane.</p>',
        freshBlock,
        '<form method="POST" action="/auth/tokens">',
        '<button class="btn" type="submit">+ Generate new token</button>',
        '</form></div>',
        '<div class="card"><table>',
        '<thead><tr><th>JTI</th><th>Status</th><th>Expires</th><th></th></tr></thead>',
        `<tbody>${rows}</tbody>`,
        '</table></div></div></body></html>',
    ].join('');
}

function notLoggedInPage(): string {
    return [
        '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Login required</title>',
        `<style>${PAGE_STYLES}</style></head><body><div class="wrap"><div class="card">`,
        '<h1>Login required</h1>',
        '<p class="lead">You need a Google session to manage personal access tokens.</p>',
        '<a class="btn" href="/auth/google/login?returnTo=%2Fauth%2Ftokens">Sign in with Google</a>',
        '</div></div></body></html>',
    ].join('');
}
