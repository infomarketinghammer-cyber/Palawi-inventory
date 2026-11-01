import { Prisma } from "@prisma/client";
import { prisma } from "./db.ts";
import { scopeArgs } from "./tenant-scope.ts";

/** Prisma client whose every query on tenant models is pinned to one client_id. */
export function tenantDb(clientId: string) {
  return prisma.$extends(
    Prisma.defineExtension({
      name: "tenant-scope",
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            return query(scopeArgs(model, operation, args as Record<string, unknown>, clientId) as typeof args);
          },
        },
      },
    }),
  );
}

export type TenantDb = ReturnType<typeof tenantDb>;
/** The client handed to `tenantDb(...).$transaction(async (tx) => ...)`. */
export type TenantTx = Parameters<Parameters<TenantDb["$transaction"]>[0]>[0];
