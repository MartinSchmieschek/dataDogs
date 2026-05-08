const { execSync } = require('child_process');

const usePostgres = ['production', 'integration'].includes(process.env.NODE_ENV || 'development');
const storeSchema = usePostgres ? 'store/prisma/schema.postgres.prisma' : 'store/prisma/schema.prisma';
const cacheSuffix = usePostgres ? ' postgres' : '';

execSync(
    `npx prisma generate --schema ${storeSchema} && node scripts/prisma-cache.cjs generate${cacheSuffix} && node scripts/prisma-json-storage.cjs generate${cacheSuffix} && node scripts/prisma-auth.cjs generate${cacheSuffix} && npx prisma db push --schema ${storeSchema} --accept-data-loss --skip-generate && node scripts/prisma-cache.cjs push${cacheSuffix} && node scripts/prisma-json-storage.cjs push${cacheSuffix} && node scripts/prisma-auth.cjs push${cacheSuffix}`,
    { stdio: 'inherit', env: process.env, shell: true },
);
