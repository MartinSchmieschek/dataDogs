/** Kontext für die umgebungsabhängige Express-Frontend-Schicht (Static / Redirect / SPA). */
export type HttpFrontEndContext = {
    devUiOrigin: string;
    /** Nur production/integration gesetzt, sonst null. */
    angularBrowserDir: string | null;
    /** `public/` (Quelle fuer /static und die Landing-Dateien unter public/landing/), sonst null. */
    publicDir: string | null;
};

export type HttpFrontEndBinder = {
    beforeControllers(app: import('express').Application, ctx: HttpFrontEndContext): void;
    afterKennelRoutes(app: import('express').Application, ctx: HttpFrontEndContext): void;
};
