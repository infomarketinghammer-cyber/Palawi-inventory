"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { tenantDb } from "@/lib/tenant";
import { failed, fieldErrors, institutionSchema, type ActionState } from "@/lib/validation";

export async function createInstitution(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdmin();
  const parsed = institutionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return failed(formData, fieldErrors(parsed.error));

  const db = tenantDb(session.clientId);
  try {
    const inst = await db.institution.create({ data: { ...parsed.data, clientId: session.clientId } });
    await audit(session, { action: "create", entity: "Institution", entityId: inst.id, newValue: parsed.data });
  } catch (e) {
    if (isUniqueViolation(e)) return failed(formData, { code: "institutions.codeTaken" });
    throw e;
  }
  revalidatePath("/admin/institutions");
  return { ok: true, message: "institutions.created" };
}
