/**
 * Stellt CACHE_DATABASE_URL für store/prisma-cache bereit (Default wie .env.example),
 * damit `prisma generate` / `db push` ohne gesetztes Env nicht scheitern.
 */
const { execSync } = require('child_process');

process.env.CACHE_DATABASE_URL = process.env.CACHE_DATABASE_URL || 'file:./cache.db';

const cmd =
    process.argv[2] === 'push'
        ? 'db push --schema store/prisma-cache/schema.prisma --accept-data-loss'
        : 'generate --schema store/prisma-cache/schema.prisma';
execSync(`npx prisma ${cmd}`, {
    stdio: 'inherit',
    env: process.env,
});
