import type { Application } from 'express';
import type { HttpFrontEndBinder, HttpFrontEndContext } from './httpFrontEndTypes';
import { bindLandingFiles } from './httpFrontEnd.landing';

/**
 * Development: keine gebaute SPA von Express. `/` liefert die Landing, sobald sie existiert;
 * bis dahin leitet Root auf ng serve (:4300) um.
 */
export const bindHttpFrontEnd: HttpFrontEndBinder = {
    beforeControllers(app: Application, ctx: HttpFrontEndContext): void {
        bindLandingFiles(app, ctx);
        app.get('/', (_req, res) => {
            res.redirect(302, `${ctx.devUiOrigin}/`);
        });
    },
    afterKennelRoutes(_app: Application, _ctx: HttpFrontEndContext): void {
        /* kein SPA-Fallback */
    },
};
