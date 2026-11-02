import { PrismaClient } from "@prisma/client";

// Unscoped client. Only use directly for platform-level work (login, client management, seeding).
// Everything tenant-owned must go through tenantDb() in tenant.ts.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Kept on globalThis so one connection pool is reused across requests (and across hot reloads in dev).
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
globalForPrisma.prisma = prisma;
