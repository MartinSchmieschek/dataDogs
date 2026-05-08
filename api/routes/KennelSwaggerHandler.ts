// The KennelSwaggerHandler — Xata's herald, forging truth from the hunt into OpenAPI scrolls.
// Its heralds are the stars it fells, the sky and Earth aflame.
import { castGrimoire } from '@datadogs/swaggrid';
import { toSwaggridCast } from '../../services/swaggridAdapter';
import { KennelRunHandler } from './KennelRunHandler';
import { canRead } from '../../mcp/auth/visibility';

/**
 * Handles Swagger/OpenAPI endpoints for kennels.
 * Delegates kennel loading and running to the KennelRunHandler.
 */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export class KennelSwaggerHandler {
    constructor(private runHandler: KennelRunHandler) {}

    registerRoutes(app: any): void {
        app.get('/api/kennels/:id/swagger.json', (req: any, res: any) => this.handleSwaggerJson(req, res));
        app.get('/api/kennels/:id/docs', (req: any, res: any) => this.handleSwaggerUi(req, res));
    }

    private async handleSwaggerJson(req: any, res: any): Promise<void> {
        try {
            const config = await this.runHandler.loadKennelConfig(req.params.id, req.query.version);
            if (!config) {
                res.status(404).json({ error: `Kennel ${req.params.id} nicht gefunden` });
                return;
            }

            // Spec is discoverable to everyone; for PRIVATE kennels we'd leak only structure
            // (paths + schemas), not data — but we don't want to leak yields either, so we
            // skip the warm-up run when the caller can't read it. The spec then carries
            // empty examples but still describes the API surface.
            const callerCanRead = canRead(config as any, req.ctx);
            const query = this.runHandler.mergeQueryParams(config.defaultQuery, req.query);
            const body = config.defaultBody;
            const waves = callerCanRead ? await this.runHandler.runKennel(config, query, body) : [];

            const spec: any = castGrimoire(toSwaggridCast(config, waves));
            this.augmentForVisibility(spec, config, req);
            res.json(spec);
        } catch (err) {
            console.error('[KennelSwaggerHandler.handleSwaggerJson]', err);
            res.status(500).json({ error: String(err) });
        }
    }

    /**
     * For private kennels, mark every operation with bearerAuth security so the Swagger UI
     * shows the lock icon and the "Authorize" button. The user pastes a PAT (from /auth/tokens)
     * and can then "Try it out" — the actual endpoint enforces canRead with that token.
     */
    private augmentForVisibility(spec: any, config: any, req: any): void {
        if (config.visibility !== 'private') return;
        spec.components = spec.components || {};
        spec.components.securitySchemes = spec.components.securitySchemes || {};
        spec.components.securitySchemes.bearerAuth = {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Personal Access Token from /auth/tokens, or OAuth-issued access token.',
        };
        const proto = (req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0].trim();
        const host = (req.get('x-forwarded-host') || req.get('host') || 'localhost:3000').split(',')[0].trim();
        const base = process.env.MCP_BASE_URL?.replace(/\/$/, '') || `${proto}://${host}`;
        spec.components.securitySchemes.oauth2 = {
            type: 'oauth2',
            description: 'Authorization Code + PKCE. Discovery: ' + base + '/.well-known/oauth-authorization-server',
            flows: {
                authorizationCode: {
                    authorizationUrl: base + '/auth/authorize',
                    tokenUrl: base + '/auth/token',
                    scopes: { default: 'Default access' },
                },
            },
        };
        spec.info = spec.info || {};
        const note =
            '\n\n> 🔒 **This pen is private.** Click **Authorize** above and paste a Bearer token ' +
            `from [${base}/auth/tokens](${base}/auth/tokens) (the owner's account) — or run the ` +
            'OAuth flow. Anonymous calls return 404.';
        spec.info.description = (spec.info.description ?? '') + note;
        for (const pathItem of Object.values(spec.paths ?? {}) as any[]) {
            if (!pathItem || typeof pathItem !== 'object') continue;
            for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
                if (!pathItem[method]) continue;
                pathItem[method].security = [{ bearerAuth: [] }, { oauth2: ['default'] }];
            }
        }
    }

    private async handleSwaggerUi(req: any, res: any): Promise<void> {
        try {
            const config = await this.runHandler.loadKennelConfig(req.params.id, req.query.version);
            if (!config) {
                res.status(404).json({ error: `Kennel ${req.params.id} nicht gefunden` });
                return;
            }
            // UI is rendered for everyone — the lock and "Authorize" button appear for private
            // kennels via the spec's security scheme. The actual run endpoint enforces canRead.
            const title = config.name || config.id;
            const titleSafe = escapeHtml(title);
            const versionSuffix = req.query.version ? `?version=${req.query.version}` : '';
            const specUrl = `/api/kennels/${req.params.id}/swagger.json${versionSuffix}`;
            const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${titleSafe} — API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; display: flex; flex-direction: column; min-height: 100vh; background: #fafafa; }
    #swagger-ui { flex: 1; min-height: 0; }

    /* OpenAPI-Info: mehrschichtig (Winkel/Stops wie von dir eingestellt) */
    .swagger-ui .info {
      margin: clamp(1.25rem, 4vw, 3rem) 0;
      width: 100%;
      box-sizing: border-box;
      padding: 1.25rem 1.5rem;
      padding-inline-start: min(22rem, 58vw);
      min-height: clamp(9rem, 22vw, 12rem);
      color: #e6f7ec;
      border: 1px solid rgba(100, 200, 140, 0.35);
      border-radius: 10px;
      background-color: #1a3d32;
      background-image:
        url(/static/swagrid.png),
        repeating-linear-gradient(
          340deg,
          transparent 0,
          transparent 18px,
          rgba(210, 255, 235, 0.2) 18px,
          rgba(210, 255, 235, 0.2) 23px,
          transparent 23px,
          transparent 52px
        ),
        repeating-linear-gradient(
          339deg,
          transparent 0,
          transparent 5px,
          rgba(255, 255, 255, 0.09) 5px,
          rgba(255, 255, 255, 0.09) 6px,
          transparent 6px,
          transparent 68px
        ),
        radial-gradient(
          ellipse 122% 90% at 0% 100%,
          rgba(160, 245, 200, 0.5) 0%,
          rgba(90, 180, 140, 0.15) 45%,
          transparent 62%
        ),
        linear-gradient(
          to top right,
          #d8df69 0%,
          #a3e7ce 32%,
          #3a8f72 66%,
          #6ca5a3 116%
        );
      background-repeat: no-repeat, no-repeat, no-repeat, no-repeat, no-repeat;
      background-position: left bottom, center, center, center, center;
    background-size: clamp(11rem, 36rem, 27rem) auto, 100% 100%, 100% 100%, 100% 100%, 100% 100%;
    }
    .swagger-ui .info .main {
      margin-left: auto;
      max-width: min(100%, 40rem);
      text-align: left;
    }
    .swagger-ui .info .title,
    .swagger-ui .info h1,
    .swagger-ui .info h2 {
      color: #f5fff8 !important;
    }
    .swagger-ui .info a {
      color: #a8f090 !important;
    }
    .swagger-ui .info code,
    .swagger-ui .info .base-url {
      color: #c8ead4 !important;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "${specUrl}",
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout",
      deepLinking: true,
    });
  </script>
</body>
</html>`;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.send(html);
        } catch (err) {
            console.error('[KennelSwaggerHandler.handleSwaggerUi]', err);
            res.status(500).json({ error: String(err) });
        }
    }
}
