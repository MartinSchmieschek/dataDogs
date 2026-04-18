'use strict';

/**
 * Zentrale Pruefung und Aufloesung der DB-URLs.
 *
 * Dev (SQLite, Default): drei separate Files (DATABASE_URL, CACHE_DATABASE_URL,
 * JSON_STORAGE_DATABASE_URL) — jede Connection hat ihre eigene Datei.
 *
 * Postgres (integration/production): nur DATABASE_URL ist Pflicht. Cache- und
 * JSON-Storage-URL werden, falls nicht explizit gesetzt, einfach auf
 * DATABASE_URL gespiegelt — alle Tabellen liegen in derselben physischen DB
 * (Schema `public`). Damit sich die `db push`-Laeufe nicht gegenseitig
 * Tabellen wegdroppen, definiert das Haupt-Schema (store/prisma/schema.postgres.prisma)
 * ALLE Tabellen, und nur dieses wird gepusht (siehe scripts/run-prisma-sync.cjs).
 * Cache- und JSON-Storage-Schemas werden nur fuer den Client-Typgenerator genutzt.
 */

function assertRequiredDbEnv() {
    const store = (process.env.DATABASE_URL || '').trim();
    const explicitCacheUrl = (process.env.CACHE_DATABASE_URL || '').trim();
    const cachePath = (process.env.CACHE_DB_PATH || '').trim();
    const explicitJsonStorageUrl = (process.env.JSON_STORAGE_DATABASE_URL || '').trim();
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
            '    DATABASE_URL="postgresql://BENUTZER:PASSWORT@HOSTNAME:5432/DATENBANK?sslmode=require"',
            '    Cache + JSON-Storage benutzen automatisch dieselbe DATABASE_URL,',
            '    wenn ihre eigenen URLs nicht gesetzt sind. Alle Tabellen liegen in `public`.',
            '',
            '  Sonderzeichen im Passwort: in der URL URL-encoden (z. B. @ -> %40).',
            '  Siehe auch: .env.example',
        );
    }

    const storeIsPostgres = isPostgresUrl(store);

    if (!explicitCacheUrl && !cachePath && !storeIsPostgres) {
        blocks.push(
            '[ENV] Cache-DB: Weder CACHE_DATABASE_URL noch CACHE_DB_PATH ist gesetzt.',
            '',
            '  Lokale Entwicklung (SQLite, Schema: store/prisma-cache/schema.prisma):',
            '    CACHE_DATABASE_URL="file:./cache.db"',
            '  oder: CACHE_DB_PATH="store/prisma-cache/cache.db"',
            '',
        );
    }

    if (!explicitJsonStorageUrl && !jsonStoragePath && !storeIsPostgres) {
        blocks.push(
            '[ENV] JSON-Storage-DB: Weder JSON_STORAGE_DATABASE_URL noch JSON_STORAGE_DB_PATH ist gesetzt.',
            '',
            '  Lokale Entwicklung (SQLite, Schema: store/prisma-json-storage/schema.prisma):',
            '    JSON_STORAGE_DATABASE_URL="file:./json-storage.db"',
            '  oder: JSON_STORAGE_DB_PATH="store/prisma-json-storage/json-storage.db"',
            '',
        );
    }

    if (blocks.length) {
        const err = new Error('\n' + blocks.join('\n'));
        err.name = 'DbEnvError';
        throw err;
    }

    /**
     * Integration: immer echte Postgres-URLs — Store, Cache und JSON-Storage
     * (JsonStorageRetriever) nutzen dieselbe DB nach Spiegelung. SQLite aus
     * `.env` allein reicht nicht; `.env.integration` muss postgresql://… setzen.
     */
    if ((process.env.NODE_ENV || '').trim() === 'integration' && !storeIsPostgres) {
        const err = new Error(
            [
                '',
                '[ENV] NODE_ENV=integration erfordert PostgreSQL als DATABASE_URL (postgresql://…).',
                '  SQLite (file:./dev.db) aus der Basis-.env ist fuer Integration unzulaessig.',
                '',
                '  In `.env.integration` eine Postgres-URL setzen (siehe `.env.integration.example`).',
                '  Cache und JSON-Storage werden auf dieselbe URL gespiegelt — alle Tabellen',
                '  entstehen mit `npm run prisma:sync:integration`.',
            ].join('\n'),
        );
        err.name = 'DbEnvError';
        throw err;
    }

    /**
     * Postgres-Mode: alle drei Clients teilen sich DATABASE_URL, falls die
     * spezifischen URLs nicht gesetzt sind. Wir spiegeln die Werte in
     * process.env, damit Prisma-Clients zur Laufzeit dieselbe DB sehen
     * wie die Push-Skripte.
     */
    if (storeIsPostgres) {
        if (!explicitCacheUrl && !cachePath) {
            process.env.CACHE_DATABASE_URL = store;
        }
        if (!explicitJsonStorageUrl && !jsonStoragePath) {
            process.env.JSON_STORAGE_DATABASE_URL = store;
        }
    }

    /**
     * Integration: Basis-.env enthaelt oft noch SQLite-URLs (file:./cache.db).
     * Die wuerden sonst die Postgres-Spiegelung verhindern — Cache/JSON muessten
     * dieselbe DB wie DATABASE_URL nutzen (ein db push, siehe run-prisma-sync.cjs).
     */
    if ((process.env.NODE_ENV || '').trim() === 'integration' && storeIsPostgres) {
        process.env.CACHE_DATABASE_URL = store;
        process.env.JSON_STORAGE_DATABASE_URL = store;
        delete process.env.CACHE_DB_PATH;
        delete process.env.JSON_STORAGE_DB_PATH;
    }

    /**
     * Konflikt-Check: nur zwischen URLs, die der Nutzer EXPLIZIT gesetzt hat.
     * Wenn jemand bewusst zwei eigene Postgres-URLs eintraegt, die auf denselben
     * (host, db, schema)-Namespace zeigen, ist das ein Konfigurationsfehler —
     * `prisma db push --accept-data-loss` wuerde sich gegenseitig Tabellen wegnehmen.
     * Auto-gespiegelte URLs (siehe oben) sind hier kein Konflikt: das Push-Skript
     * pusht in Postgres-Mode nur das Haupt-Schema; Cache/JSON werden nur
     * generiert (kein db push).
     */
    assertNoExplicitPostgresSchemaConflict({
        DATABASE_URL: store,
        CACHE_DATABASE_URL: explicitCacheUrl,
        JSON_STORAGE_DATABASE_URL: explicitJsonStorageUrl,
    });
}

function isPostgresUrl(raw) {
    return typeof raw === 'string' && /^postgres(ql)?:\/\//i.test(raw);
}

function assertNoExplicitPostgresSchemaConflict(urls) {
    const parsed = [];
    for (const [name, raw] of Object.entries(urls)) {
        if (!raw) continue;
        const info = parsePostgresUrl(raw);
        if (info) parsed.push({ name, ...info });
    }
    if (parsed.length < 2) return;

    for (let i = 0; i < parsed.length; i++) {
        for (let j = i + 1; j < parsed.length; j++) {
            const a = parsed[i];
            const b = parsed[j];
            const rawA = (urls[a.name] || '').trim();
            const rawB = (urls[b.name] || '').trim();
            if (rawA && rawA === rawB) continue;
            if (a.host !== b.host || a.port !== b.port || a.db !== b.db) continue;
            if (a.schema !== b.schema) continue;
            const err = new Error(
                [
                    '',
                    `[ENV] ${a.name} und ${b.name} sind beide explizit gesetzt und zeigen auf denselben Postgres-Namespace:`,
                    `  host=${a.host}  port=${a.port}  db=${a.db}  schema=${a.schema}`,
                    '',
                    '  Wenn du absichtlich EINE DB fuer alles nutzt, setz nur DATABASE_URL und',
                    '  loesche CACHE_DATABASE_URL / JSON_STORAGE_DATABASE_URL — dbEnv.cjs spiegelt',
                    '  sie automatisch und das Sync-Skript pusht in Postgres-Mode nur das',
                    '  Haupt-Schema (store/prisma/schema.postgres.prisma), das alle Tabellen kennt.',
                    '',
                    '  Wenn du tatsaechlich getrennte Namespaces willst, gib unterschiedliche',
                    '  ?schema=…-Werte an (z. B. ?schema=cache, ?schema=json_storage).',
                ].join('\n'),
            );
            err.name = 'DbEnvError';
            throw err;
        }
    }
}

function parsePostgresUrl(raw) {
    if (!isPostgresUrl(raw)) return null;
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
 * Liefert die Cache-DB-URL fuer Prisma. Postgres: nutzt CACHE_DATABASE_URL
 * (wurde von assertRequiredDbEnv ggf. auf DATABASE_URL gespiegelt). SQLite-Dev:
 * faellt auf CACHE_DB_PATH zurueck.
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
 * Liefert die JSON-Storage-DB-URL fuer Prisma. Verhalten analog zu
 * resolveCacheDatabaseUrl.
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
