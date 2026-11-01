"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireClientManager } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { identifierTaken } from "@/lib/users";
import { defaultItems } from "@/lib/default-items";
import { clientCreateSchema, failed, fieldErrors, formToObject, type ActionState } from "@/lib/validation";

/** Creates a client with its first institution and first admin, in one transaction. */
export async function createClient(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireClientManager();
  const parsed = clientCreateSchema.safeParse(formToObject(formData));
  if (!parsed.success) return failed(formData, fieldErrors(parsed.error));
  const { client, institution, admin } = parsed.data;
  if (await identifierTaken(admin.email, admin.phone)) return failed(formData, { "admin.phone": "users.identifierTaken" });

  try {
    await prisma.$transaction(async (tx) => {
      const c = await tx.client.create({ data: client });
      const i = await tx.institution.create({ data: { ...institution, clientId: c.id } });
      const u = await tx.user.create({
        data: {
          clientId: c.id,
          name: admin.name,
          email: admin.email,
          phone: admin.phone,
          passwordHash: await hashPassword(admin.password),
          role: "ADMIN",
        },
      });
      await tx.item.createMany({ data: defaultItems(c.id) });
      // Recorded in the new client's log (so its admins see how it was set up) and in the creator's.
      for (const clientId of new Set([c.id, session.clientId])) {
        await audit(session, { action: "create", entity: "Client", entityId: c.id, newValue: client, clientId }, tx);
      }
      await audit(session, { action: "create", entity: "Institution", entityId: i.id, newValue: institution, clientId: c.id }, tx);
      await audit(session, { action: "create", entity: "User", entityId: u.id, newValue: { ...admin, role: "ADMIN" }, clientId: c.id }, tx);
    });
  } catch (e) {
    if (isUniqueViolation(e)) return failed(formData, { "client.code": "clients.codeTaken" });
    throw e;
  }

  revalidatePath("/admin/clients");
  return { ok: true, message: "clients.created" };
}
