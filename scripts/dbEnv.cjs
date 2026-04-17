'use strict';

/**
 * Zentrale Prüfung und Auflösung der DB-URLs.
 * Nachrichten absichtlich ausführlich — bei Fehler sieht der Entwickler, was in .env fehlt.
 */

function assertRequiredDbEnv() {
    const store = (process.env.DATABASE_URL || '').trim();
    const cacheUrl = (process.env.CACHE_DATABASE_URL || '').trim();
    const cachePath = (process.env.CACHE_DB_PATH || '').trim();
    const jsonStorageUrl = (process.env.JSON_STORAGE_DATABASE_URL || '').trim();
    const jsonStoragePath = (process.env.JSON_STORAGE_DB_PATH || '').trim();

    const blocks = [];

    if (!store) {
        blocks.push(
            '[ENV] DATABASE_URL fehlt oder ist leer.',
            '',
            '  Lokale Entwicklung (SQLite, Schema: store/prisma/schema.prisma):',
            '    DATABASE_URL="file:./dev.db"',
            '',
            '  Integration/Production (PostgreSQL, Schema: store/prisma/schema.postgres.prisma):',
            '    DATABASE_URL="postgresql://BENUTZER:PASSWORT@HOSTNAME:5432/DATENBANKNAME?sslmode=require"',
            '    Optional Default-Schema: …?sslmode=require&schema=store (wenn dieselbe DB wie Cache/JSON genutzt wird).',
            '',
            '  Sonderzeichen im Passwort: in der URL URL-encoden (z. B. @ → %40).',
            '  Siehe auch: .env.example',
        );
    }

    if (!cacheUrl && !cachePath) {
        blocks.push(
            '[ENV] Cache-DB: Weder CACHE_DATABASE_URL noch CACHE_DB_PATH ist gesetzt.',
            '',
            '  Lokale Entwicklung (SQLite, Schema: store/prisma-cache/schema.prisma):',
            '    CACHE_DATABASE_URL="file:./cache.db"',
            '  oder: CACHE_DB_PATH="store/prisma-cache/cache.db"',
            '',
            '  Integration/Production (PostgreSQL, Schema: store/prisma-cache/schema.postgres.prisma):',
            '    CACHE_DATABASE_URL="postgresql://BENUTZER:PASSWORT@HOSTNAME:5432/CACHE_DATENBANK?sslmode=require"',
            '    Teilst du eine physische DB mit Store/JSON-Storage: …&schema=anderes_schema setzen (siehe .env.integration.example).',
            '',
        );
    }

    if (!jsonStorageUrl && !jsonStoragePath) {
        blocks.push(
            '[ENV] JSON-Storage-DB: Weder JSON_STORAGE_DATABASE_URL noch JSON_STORAGE_DB_PATH ist gesetzt.',
            '',
            '  Lokale Entwicklung (SQLite, Schema: store/prisma-json-storage/schema.prisma):',
            '    JSON_STORAGE_DATABASE_URL="file:./json-storage.db"',
            '  oder: JSON_STORAGE_DB_PATH="store/prisma-json-storage/json-storage.db"',
            '',
            '  Integration/Production (PostgreSQL, Schema: store/prisma-json-storage/schema.postgres.prisma):',
            '    JSON_STORAGE_DATABASE_URL="postgresql://BENUTZER:PASSWORT@HOSTNAME:5432/JSON_STORAGE_DB?sslmode=require"',
            '    Teilst du eine physische DB mit Store/Cache: …&schema=anderes_schema setzen (siehe .env.integration.example).',
            '',
        );
    }

    if (blocks.length) {
        const err = new Error('\n' + blocks.join('\n'));
        err.name = 'DbEnvError';
        throw err;
    }

    assertNoPostgresSchemaConflict({
        DATABASE_URL: store,
        CACHE_DATABASE_URL: cacheUrl,
        JSON_STORAGE_DATABASE_URL: jsonStorageUrl,
    });
}

/**
 * Verhindert, dass mehrere Prisma-Connections auf denselben Postgres-Namespace zeigen.
 *
 * Hintergrund: `prisma db push` (Cache/JSON-Storage laufen mit --accept-data-loss) sieht
 * jedes Schema als Single Source of Truth fuer sein Postgres-Schema. Teilen sich zwei
 * Connections (host, port, db, schema), droppt jeder Push die Tabellen des anderen.
 *
 * Regel: zwei Postgres-URLs duerfen auf dieselbe DB zeigen, aber NICHT auf denselben
 * ?schema=-Namespace (Default `public`). Sonst hart abbrechen — besser jetzt
 * als nach verlorenen Tabellen.
 */
function assertNoPostgresSchemaConflict(urls) {
    const parsed = [];
    for (const [name, raw] of Object.entries(urls)) {
        if (!raw) continue;
        const info = parsePostgresUrl(raw);
        if (info) parsed.push({ name, ...info });
    }

    for (let i = 0; i < parsed.length; i++) {
        for (let j = i + 1; j < parsed.length; j++) {
            const a = parsed[i];
            const b = parsed[j];
            if (a.host !== b.host || a.port !== b.port || a.db !== b.db) continue;
            if (a.schema !== b.schema) continue;
            const err = new Error(
                [
                    '',
                    `[ENV] ${a.name} und ${b.name} zeigen auf denselben Postgres-Namespace:`,
                    `  host=${a.host}  port=${a.port}  db=${a.db}  schema=${a.schema}`,
                    '',
                    '  Das ist bei Prisma toedlich: jeder `db push` (Cache/JSON-Storage mit',
                    '  --accept-data-loss) droppt die Tabellen des jeweils anderen Clients.',
                    '',
                    '  Loesung: unterschiedliche Postgres-Schemas pro Connection via ?schema=...',
                    '  Beispiel (Cache + JSON-Storage auf derselben DB):',
                    `    CACHE_DATABASE_URL="postgresql://…/sharedDb?sslmode=require&schema=cache"`,
                    `    JSON_STORAGE_DATABASE_URL="postgresql://…/sharedDb?sslmode=require&schema=json_storage"`,
                    '',
                    '  Prisma legt das Schema beim Push automatisch an, wenn es fehlt.',
                ].join('\n'),
            );
            err.name = 'DbEnvError';
            throw err;
        }
    }
}

function parsePostgresUrl(raw) {
    if (!/^postgres(ql)?:\/\//i.test(raw)) return null;
    try {
        const u = new URL(raw);
        const host = u.hostname.toLowerCase();
        const port = u.port || '5432';
        const db = (u.pathname || '').replace(/^\//, '').toLowerCase();
        const schema = (u.searchParams.get('schema') || 'public').toLowerCase();
        return { host, port, db, schema };
    } catch {
        return null;
    }
}

/**
 * Setzt aus CACHE_DATABASE_URL oder CACHE_DB_PATH die finale URL für Prisma (Cache-Schema).
 */
function resolveCacheDatabaseUrl() {
    const cacheUrl = (process.env.CACHE_DATABASE_URL || '').trim();
    if (cacheUrl) return cacheUrl;
    const pathOnly = (process.env.CACHE_DB_PATH || '').trim();
    if (!pathOnly) {
        throw new Error('resolveCacheDatabaseUrl: CACHE_DATABASE_URL / CACHE_DB_PATH fehlt (assertRequiredDbEnv zuerst aufrufen).');
    }
    if (pathOnly.startsWith('file:')) return pathOnly;
    return `file:${pathOnly.replace(/\\/g, '/')}`;
}

/**
 * Setzt aus JSON_STORAGE_DATABASE_URL oder JSON_STORAGE_DB_PATH die finale URL
 * fuer Prisma (JSON-Storage-Schema).
 */
function resolveJsonStorageDatabaseUrl() {
    const jsonStorageUrl = (process.env.JSON_STORAGE_DATABASE_URL || '').trim();
    if (jsonStorageUrl) return jsonStorageUrl;
    const pathOnly = (process.env.JSON_STORAGE_DB_PATH || '').trim();
    if (!pathOnly) {
        throw new Error('resolveJsonStorageDatabaseUrl: JSON_STORAGE_DATABASE_URL / JSON_STORAGE_DB_PATH fehlt (assertRequiredDbEnv zuerst aufrufen).');
    }
    if (pathOnly.startsWith('file:')) return pathOnly;
    return `file:${pathOnly.replace(/\\/g, '/')}`;
}

module.exports = { assertRequiredDbEnv, resolveCacheDatabaseUrl, resolveJsonStorageDatabaseUrl };
