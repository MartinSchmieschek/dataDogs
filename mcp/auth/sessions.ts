// Cookie-based session middleware for the browser login flow.
// Stores PKCE state during the OAuth round-trip, then the resolved userId after callback.
// Memory store is fine for single-instance Render — for horizontal scaling, swap to Postgres/Redis later.

import session from 'express-session';
import type { RequestHandler } from 'express';

declare module 'express-session' {
    interface SessionData {
        userId?: string;
        pkce?: {
            codeVerifier: string;
            state: string;
            returnTo?: string;
        };
    }
}

export function createSessionMiddleware(): RequestHandler {
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
        throw new Error('SESSION_SECRET must be set in .env (32+ random chars)');
    }

    const secure = process.env.SESSION_COOKIE_SECURE === 'true';

    return session({
        secret,
        name: 'datadogs.sid',
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure,
            sameSite: 'lax',
            maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        },
    });
}
