import "server-only";
import type { TenantDb } from "@/lib/tenant";
import { getBalances } from "@/lib/entries";
import { loadItemOptions } from "@/lib/ui-data";
import { MODULES, type ModuleKey } from "@/lib/modules";
import type { AppLocale } from "@/lib/format";

/** Items, usable stock per item and (for meals) past menus offered as suggestions. */
export async function loadFormData(db: TenantDb, module: ModuleKey, institutionId: string | null, locale: AppLocale, excludeEntryId?: string) {
  const cfg = MODULES[module];
  const items = await loadItemOptions(db, cfg.categories, locale);
  const available: Record<string, number> = {};
  if (institutionId && cfg.lineMode !== "none") {
    const bal = await getBalances(db, institutionId, { excludeEntryId });
    for (const [id, b] of bal) available[id] = b.approved + b.pendingIn - b.pendingOut;
  }
  let suggestions: string[] = [];
  if (module === "meals") {
    const recent = await db.entry.findMany({ where: { module: "meals" }, orderBy: { date: "desc" }, take: 60, select: { fields: true } });
    const set = new Set<string>();
    for (const r of recent) for (const v of Object.values((r.fields ?? {}) as Record<string, unknown>)) if (typeof v === "string" && v) set.add(v);
    suggestions = [...set].slice(0, 50);
  }
  return { items, available, suggestions };
}
