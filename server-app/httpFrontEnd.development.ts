import type { Application } from 'express';
import type { HttpFrontEndBinder, HttpFrontEndContext } from './httpFrontEndTypes';

/** Development: keine gebaute SPA von Express — Root leitet auf ng serve (:4300) um. */
export const bindHttpFrontEnd: HttpFrontEndBinder = {
    beforeControllers(app: Application, ctx: HttpFrontEndContext): void {
        app.get('/', (_req, res) => {
            res.redirect(302, `${ctx.devUiOrigin}/`);
        });
    },
    afterKennelRoutes(_app: Application, _ctx: HttpFrontEndContext): void {
        /* kein SPA-Fallback */
    },
};
