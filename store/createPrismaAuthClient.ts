/**
 * Auth-Prisma-Client aus store/generated/prisma-auth-client — Pfad relativ zum
 * Projektroot (process.cwd()), damit dist/server-app/main.js nicht nach
 * dist/store/generated sucht.
 */

import path from 'path';
import type { PrismaClient } from './generated/prisma-auth-client';

export function createPrismaAuthClient(): PrismaClient {
    const mod = require(path.join(process.cwd(), 'store/generated/prisma-auth-client')) as typeof import('./generated/prisma-auth-client');
    return new mod.PrismaClient();
}
