const { execSync } = require('child_process');

const usePostgres = ['production', 'integration'].includes(process.env.NODE_ENV || 'development');
const storeSchema = usePostgres ? 'store/prisma/schema.postgres.prisma' : 'store/prisma/schema.prisma';
const cacheSuffix = usePostgres ? ' postgres' : '';

execSync(
    `npm run build:packages && npx prisma generate --schema ${storeSchema} && node scripts/prisma-cache.cjs generate${cacheSuffix} && tsc -p tsconfig.build.json`,
    {
        stdio: 'inherit',
        env: process.env,
        shell: true,
    },
);
