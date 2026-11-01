"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAdmin, requireUser } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { parseEntry, todayIST } from "@/lib/entry-form";
import {
  approveDay,
  approveEntry,
  createEntry,
  deleteEntry,
  rejectEntry,
  setAdminFields,
  unlockEntry,
  updateEntry,
  type EngineResult,
} from "@/lib/entries";
import { isModuleKey, type ModuleKey } from "@/lib/modules";
import { formToObject, type ActionState } from "@/lib/validation";
import { doneRedirect } from "@/lib/done-redirect";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { itemNames } from "@/lib/ui-data";
import { formatNumber } from "@/lib/format";
import type { Session } from "@/lib/session-token";

/** Turns an engine failure into action state, spelling out stock shortages per item. */
async function failure(session: Session, r: Extract<EngineResult, { ok: false }>): Promise<ActionState> {
  if (!r.shortages?.length) return { ok: false, message: r.error };
  const t = await getTranslations("entries");
  const { locale, numerals } = await getFormatPrefs();
  const names = await itemNames(tenantDb(session.clientId), locale);
  return {
    ok: false,
    message: r.error,
    details: r.shortages.map((s) =>
      t("shortage", {
        item: names.get(s.itemId)?.name ?? s.itemId,
        need: formatNumber(s.need, { numerals }),
        available: formatNumber(s.available, { numerals }),
      }),
    ),
  };
}

function revalidateRegisters(module?: string) {
  revalidatePath("/", "layout");
  if (module) revalidatePath(`/registers/${module}`);
}

/** Create (entryId null) or edit an entry. Bound per register: saveEntry.bind(null, module, entryId). */
export async function saveEntry(module: ModuleKey, entryId: string | null, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireUser();
  if (!isModuleKey(module)) return { ok: false, message: "invalid" };
  const parsed = parseEntry(module, formToObject(formData), session.role, todayIST());
  if (!parsed.ok) return { ok: false, errors: parsed.errors, message: parsed.errors.lines ?? "validation.invalid" };
  const r = entryId ? await updateEntry(session, entryId, parsed.data) : await createEntry(session, module, parsed.data);
  if (!r.ok) return failure(session, r);
  revalidateRegisters(module);
  redirect(`/registers/${module}/${r.id}?done=saved`);
}

const idOf = (fd: FormData) => String(fd.get("id") ?? "");
const textOf = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function approveEntryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireAdmin();
  const r = await approveEntry(session, idOf(fd), textOf(fd, "overrideReason") || undefined);
  if (!r.ok) return failure(session, r);
  revalidateRegisters(textOf(fd, "module"));
  doneRedirect(fd, "approved");
  return { ok: true, message: "entries.approved" };
}

export async function rejectEntryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireAdmin();
  const r = await rejectEntry(session, idOf(fd), textOf(fd, "reason"));
  if (!r.ok) return { ok: false, message: r.error, errors: r.error === "entries.reasonRequired" ? { reason: r.error } : undefined };
  revalidateRegisters(textOf(fd, "module"));
  doneRedirect(fd, "rejected");
  return { ok: true, message: "entries.rejected" };
}

export async function unlockEntryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireAdmin();
  const r = await unlockEntry(session, idOf(fd), textOf(fd, "reason"));
  if (!r.ok) return { ok: false, message: r.error, errors: r.error === "entries.reasonRequired" ? { reason: r.error } : undefined };
  revalidateRegisters(textOf(fd, "module"));
  doneRedirect(fd, "unlocked");
  return { ok: true, message: "entries.unlocked" };
}

export async function deleteEntryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireUser();
  const mod = textOf(fd, "module");
  const r = await deleteEntry(session, idOf(fd));
  if (!r.ok) return { ok: false, message: r.error };
  revalidateRegisters(mod);
  redirect(`/registers/${mod}?done=deleted`);
}

export async function adminFieldsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireAdmin();
  const values: Record<string, string | null> = {};
  for (const [k, v] of fd.entries()) if (k.startsWith("fields.") && typeof v === "string") values[k.slice(7)] = v;
  const r = await setAdminFields(session, idOf(fd), values);
  if (!r.ok) return { ok: false, message: r.error };
  revalidateRegisters(textOf(fd, "module"));
  return { ok: true, message: "entries.adminFieldsSaved" };
}

export async function approveDayAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const session = await requireAdmin();
  const day = textOf(fd, "day");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, message: "invalid" };
  const { approved, skipped } = await approveDay(session, day);
  revalidateRegisters();
  doneRedirect(fd, "day", { approvedCount: approved, skipped });
  const t = await getTranslations("approvals");
  return { ok: true, details: [t("dayDone", { approved, skipped })] };
}
