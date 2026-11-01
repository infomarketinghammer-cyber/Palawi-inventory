// Pure argument rewriting for tenant isolation, used by the Prisma extension in tenant.ts.
// Kept free of imports so it can be unit tested directly.

/** Models that carry client_id. Every query on these is forced to the session's client. */
export const TENANT_MODELS = new Set([
  "Institution",
  "User",
  "AuditLog",
  "Item",
  "Entry",
  "StockMovement",
  "Visitor",
  "Visit",
  "Donation",
  "ImportBatch",
  "Counter",
]);

/** Models with deletedAt; reads hide soft-deleted rows unless the caller filters on deletedAt.
 * On MongoDB an unset field is missing (not null), so "not deleted" is `{ isSet: false }`. */
export const SOFT_DELETE_MODELS = new Set(["Institution", "User", "Item", "Entry", "Visit", "Donation"]);

const WHERE_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
]);
const READ_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

export class TenantViolation extends Error {}

type Args = Record<string, unknown> & { where?: Record<string, unknown>; data?: unknown; create?: unknown };

function stampData(data: unknown, clientId: string): unknown {
  if (Array.isArray(data)) return data.map((d) => stampData(d, clientId));
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    if (rec.clientId !== undefined && rec.clientId !== clientId) {
      throw new TenantViolation("Attempt to write a row for another client");
    }
    if ("client" in rec) throw new TenantViolation("Use clientId, not a client relation, on tenant models");
    return { ...rec, clientId };
  }
  return data;
}

/** Returns new args with client_id enforced. Throws TenantViolation on cross-tenant writes. */
export function scopeArgs(model: string, operation: string, args: Args | undefined, clientId: string): Args {
  if (!TENANT_MODELS.has(model)) return args ?? {};
  if (!clientId) throw new TenantViolation("No client in session");
  const next: Args = { ...(args ?? {}) };

  if (WHERE_OPS.has(operation)) {
    const where = { ...(next.where ?? {}) };
    if (where.clientId !== undefined && where.clientId !== clientId) {
      throw new TenantViolation("Attempt to read or change another client's rows");
    }
    where.clientId = clientId;
    if (READ_OPS.has(operation) && SOFT_DELETE_MODELS.has(model) && !("deletedAt" in where)) {
      where.deletedAt = { isSet: false };
    }
    next.where = where;
  }
  if (operation === "create" || operation === "createMany" || operation === "createManyAndReturn") {
    next.data = stampData(next.data, clientId);
  }
  if (operation === "upsert") {
    next.create = stampData(next.create, clientId);
  }
  if ((operation === "update" || operation === "updateMany" || operation === "upsert") && next.data) {
    const d = next.data as Record<string, unknown>;
    if (d.clientId !== undefined && d.clientId !== clientId) {
      throw new TenantViolation("Attempt to move a row to another client");
    }
  }
  return next;
}
