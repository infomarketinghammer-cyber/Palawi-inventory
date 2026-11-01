"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { tenantDb } from "@/lib/tenant";
import { failed, fieldErrors, itemSchema, type ActionState } from "@/lib/validation";

/** Create (id null) or update an item. Bound: saveItem.bind(null, id). */
export async function saveItem(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireAdmin();
  const parsed = itemSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return failed(fd, fieldErrors(parsed.error));
  const db = tenantDb(session.clientId);
  const data = { ...parsed.data, group: parsed.data.category === "VEGETABLE" ? parsed.data.group : null, location: parsed.data.location ?? null };
  try {
    if (id) {
      const before = await db.item.findFirst({ where: { id } });
      if (!before) return { ok: false, message: "entries.notFound" };
      await db.item.update({ where: { id }, data });
      await audit(session, { action: "update", entity: "Item", entityId: id, oldValue: before, newValue: data });
    } else {
      const item = await db.item.create({ data: { ...data, clientId: session.clientId } });
      await audit(session, { action: "create", entity: "Item", entityId: item.id, newValue: data });
    }
  } catch (e) {
    if (isUniqueViolation(e)) return failed(fd, { code: "items.codeTaken" });
    throw e;
  }
  revalidatePath("/items");
  if (id) redirect("/items?done=saved");
  return { ok: true, message: "items.saved" };
}

export async function toggleItemAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  const db = tenantDb(session.clientId);
  const item = await db.item.findFirst({ where: { id } });
  if (!item) return { ok: false, message: "entries.notFound" };
  await db.item.update({ where: { id }, data: { active: !item.active } });
  await audit(session, { action: "update", entity: "Item", entityId: id, oldValue: { active: item.active }, newValue: { active: !item.active } });
  revalidatePath("/items");
  return { ok: true };
}
