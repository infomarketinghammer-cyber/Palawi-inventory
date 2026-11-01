import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { Session } from "./session-token";

type AuditInput = {
  action: "create" | "update" | "delete" | "approve" | "reject" | "unlock" | "login" | "login_failed" | "password_change";
  entity: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  /** Defaults to the session's client; set when acting on another client (platform admin creating a client). */
  clientId?: string;
};

const SECRET_KEYS = new Set(["passwordHash", "password"]);

function redact(v: unknown): Prisma.InputJsonValue | undefined {
  if (v === undefined || v === null) return undefined;
  return JSON.parse(JSON.stringify(v, (k, val) => (SECRET_KEYS.has(k) ? "[redacted]" : val)));
}

/** Anything that can write an audit row: the base client, a transaction, or a tenant-scoped client. */
type Tx = { auditLog: { create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown> } };

export async function audit(session: Session | null, input: AuditInput, tx: Tx = prisma) {
  const clientId = input.clientId ?? session?.clientId;
  if (!clientId) throw new Error("audit() needs a client");
  await tx.auditLog.create({
    data: {
      clientId,
      institutionId: session?.institutionId ?? null,
      userId: session?.userId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      oldValue: redact(input.oldValue),
      newValue: redact(input.newValue),
      reason: input.reason,
    },
  });
}
