/**
 * Stellt JSON_STORAGE_DATABASE_URL fuer store/prisma-json-storage bereit
 * (nach Validierung in dbEnv.cjs). Analog zu prisma-cache.cjs.
 */
const { execSync } = require('child_process');
const { assertRequiredDbEnv, resolveJsonStorageDatabaseUrl } = require('./dbEnv.cjs');

assertRequiredDbEnv();
process.env.JSON_STORAGE_DATABASE_URL = resolveJsonStorageDatabaseUrl();

const variant = process.argv[3];
const usePostgres = variant === 'postgres';
const schema = usePostgres
    ? 'store/prisma-json-storage/schema.postgres.prisma'
    : 'store/prisma-json-storage/schema.prisma';

const cmd =
    process.argv[2] === 'push'
        ? `db push --schema ${schema} --accept-data-loss`
        : `generate --schema ${schema}`;
execSync(`npx prisma ${cmd}`, {
    stdio: 'inherit',
    env: process.env,
});
