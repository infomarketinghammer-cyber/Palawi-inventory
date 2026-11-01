"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { commitGateImport, dryRunGateImport, rollbackGateImport } from "@/lib/gate-import";
import type { ActionState } from "@/lib/validation";
import { doneRedirect } from "@/lib/done-redirect";

const MAX_BYTES = 10 * 1024 * 1024;

export async function uploadGateAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireAdmin();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "imports.needFile" };
  if (file.size > MAX_BYTES || !/\.xlsx$/i.test(file.name)) return { ok: false, message: "imports.badHeader" };
  let r;
  try {
    r = await dryRunGateImport(session, file.name, await file.arrayBuffer());
  } catch {
    return { ok: false, message: "imports.badHeader" };
  }
  if (!r.ok) return { ok: false, message: r.error };
  redirect(`/imports/${r.id}`);
}

export async function commitImportAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireAdmin();
  const r = await commitGateImport(session, String(fd.get("id") ?? ""));
  if (!r.ok) return { ok: false, message: r.error };
  revalidatePath("/", "layout");
  doneRedirect(fd, "committed");
  return { ok: true, message: "imports.committed" };
}

export async function rollbackImportAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireAdmin();
  const r = await rollbackGateImport(session, String(fd.get("id") ?? ""));
  if (!r.ok) return { ok: false, message: r.error };
  revalidatePath("/", "layout");
  doneRedirect(fd, "rolledBack");
  return { ok: true, message: "imports.rolledBack" };
}
