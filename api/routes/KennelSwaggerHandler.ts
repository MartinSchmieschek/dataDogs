// The KennelSwaggerHandler — Xata's herald, forging truth from the hunt into OpenAPI scrolls.
// Its heralds are the stars it fells, the sky and Earth aflame.
import { IKennelConfig } from '@datadogs/core';
import { SwaggerGenerator } from '../../services/SwaggerGenerator';
import { KennelRunHandler } from './KennelRunHandler';

/**
 * Handles Swagger/OpenAPI endpoints for kennels.
 * Delegates kennel loading and running to the KennelRunHandler.
 */
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

            const query = this.runHandler.mergeQueryParams(config.defaultQuery, req.query);
            const body = config.defaultBody;
            const waves = await this.runHandler.runKennel(config, query, body);

            const spec = SwaggerGenerator.generate(config, waves);
            res.json(spec);
        } catch (err) {
            console.error('[KennelSwaggerHandler.handleSwaggerJson]', err);
            res.status(500).json({ error: String(err) });
        }
    }

    private async handleSwaggerUi(req: any, res: any): Promise<void> {
        try {
            const config = await this.runHandler.loadKennelConfig(req.params.id, req.query.version);
            if (!config) {
                res.status(404).json({ error: `Kennel ${req.params.id} nicht gefunden` });
                return;
            }
            const title = config.name || config.id;
            const versionSuffix = req.query.version ? `?version=${req.query.version}` : '';
            const specUrl = `/api/kennels/${req.params.id}/swagger.json${versionSuffix}`;
            const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title} — API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; }
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
