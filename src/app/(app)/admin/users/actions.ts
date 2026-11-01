"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { tenantDb } from "@/lib/tenant";
import { identifierTaken } from "@/lib/users";
import { failed, fieldErrors, userCreateSchema, type ActionState } from "@/lib/validation";

export async function createUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdmin();
  const parsed = userCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failed(formData, fieldErrors(parsed.error));
  const { password, institutionId, ...rest } = parsed.data;
  const db = tenantDb(session.clientId);

  // The institution must belong to this client (tenantDb scopes the lookup).
  if (institutionId && !(await db.institution.findFirst({ where: { id: institutionId } }))) {
    return failed(formData, { institutionId: "invalid" });
  }

  if (await identifierTaken(rest.email, rest.phone)) return failed(formData, { phone: "users.identifierTaken" });

  const user = await db.user.create({
    data: {
      ...rest,
      clientId: session.clientId,
      institutionId: institutionId ?? null,
      passwordHash: await hashPassword(password),
    },
  });
  await audit(session, { action: "create", entity: "User", entityId: user.id, newValue: { ...rest, institutionId } });
  revalidatePath("/admin/users");
  return { ok: true, message: "users.created" };
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionState> {
  const session = await requireAdmin();
  if (userId === session.userId) return { ok: false, message: "users.cannotDeactivateSelf" };
  const db = tenantDb(session.clientId);
  const before = await db.user.findFirst({ where: { id: userId }, select: { active: true } });
  if (!before) return { ok: false, message: "invalid" };
  await db.user.update({ where: { id: userId }, data: { active } });
  await audit(session, { action: "update", entity: "User", entityId: userId, oldValue: before, newValue: { active } });
  revalidatePath("/admin/users");
  return { ok: true };
}
