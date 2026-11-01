"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireUser } from "@/lib/auth";
import { approveVisit, createVisit, rejectVisit, visitSchema } from "@/lib/visits";
import { todayIST } from "@/lib/entry-form";
import { echo, fieldErrors, formToObject, type ActionState } from "@/lib/validation";
import { doneRedirect } from "@/lib/done-redirect";

export async function createVisitAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireUser();
  const parsed = visitSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), message: "validation.invalid", values: echo(fd) };
  const r = await createVisit(session, parsed.data, todayIST());
  if (!r.ok) return { ok: false, message: r.error, values: echo(fd) };
  revalidatePath("/", "layout");
  redirect(`/gate/${r.id}?done=saved`);
}

export async function approveVisitAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireAdmin();
  const r = await approveVisit(session, String(fd.get("id") ?? ""));
  if (!r.ok) return { ok: false, message: r.error };
  revalidatePath("/", "layout");
  doneRedirect(fd, "approved");
  return { ok: true, message: "entries.approved" };
}

export async function rejectVisitAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireAdmin();
  const r = await rejectVisit(session, String(fd.get("id") ?? ""), String(fd.get("reason") ?? ""));
  if (!r.ok) return { ok: false, message: r.error, errors: r.error === "entries.reasonRequired" ? { reason: r.error } : undefined };
  revalidatePath("/", "layout");
  doneRedirect(fd, "rejected");
  return { ok: true, message: "entries.rejected" };
}
