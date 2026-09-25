import fs from 'fs';
import path from 'path';
import type { Application } from 'express';
import { ROOT_ROUTE } from '../api/routes/routeTable';
import type { HttpFrontEndContext } from './httpFrontEndTypes';

/**
 * Haken fuer das Schaufenster: `/` und `/robots.txt` liefern die statischen Dateien aus
 * `public/landing/` — DB-frei, vor express.static und vor jeder Route. Solange die Datei
 * fehlt (die Landing kommt in P5), reicht der Haken per next() weiter: `/` verhaelt sich
 * dann wie bisher (gebaute SPA bzw. Dev-Redirect).
 */
export function bindLandingFiles(app: Application, ctx: HttpFrontEndContext): void {
    const serve = (fileName: string, cacheControl: string) => (_req: any, res: any, next: any) => {
        const file = ctx.publicDir ? path.join(ctx.publicDir, 'landing', fileName) : null;
        if (!file || !fs.existsSync(file)) {
            next();
            return;
        }
        res.setHeader('Cache-Control', cacheControl);
        res.sendFile(file);
    };
    app.get(ROOT_ROUTE.landing, serve('index.html', 'public, max-age=300'));
    app.get(ROOT_ROUTE.robots, serve('robots.txt', 'public, max-age=300'));
}
