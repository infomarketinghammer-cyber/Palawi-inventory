"use server";

import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { failed, fieldErrors, passwordChangeSchema, type ActionState } from "@/lib/validation";

export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireUser();
  const parsed = passwordChangeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    if (errors.confirm === "mismatch") errors.confirm = "settings.mismatch";
    return failed(formData, errors);
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!(await verifyPassword(parsed.data.current, user.passwordHash))) {
    return failed(formData, { current: "settings.wrongPassword" });
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.next) } });
  await audit(session, { action: "password_change", entity: "User", entityId: user.id });
  return { ok: true, message: "settings.passwordChanged" };
}
