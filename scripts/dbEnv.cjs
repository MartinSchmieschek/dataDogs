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
            '',
            '  Optional dieselbe PostgreSQL-Instanz wie DATABASE_URL (Tabellen Dog / CacheEntry getrennt).',
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
            '',
            '  Optional dieselbe PostgreSQL-Instanz wie DATABASE_URL (Tabelle JsonEntry getrennt).',
        );
    }

    if (blocks.length) {
        const err = new Error('\n' + blocks.join('\n'));
        err.name = 'DbEnvError';
        throw err;
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
