import { PrismaClient } from "@prisma/client";

// Unscoped client. Only use directly for platform-level work (login, client management, seeding).
// Everything tenant-owned must go through tenantDb() in tenant.ts.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
