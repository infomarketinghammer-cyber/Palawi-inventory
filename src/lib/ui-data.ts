import "server-only";
import type { TenantDb } from "./tenant";
import { localName, type AppLocale } from "./format";

export type ItemOption = { id: string; name: string; unit: string; category: string; group: string | null; reorderLevel: number | null };

/** Active items of the given categories, localised and sorted for pickers. */
export async function loadItemOptions(db: TenantDb, categories: readonly string[], locale: AppLocale): Promise<ItemOption[]> {
  if (!categories.length) return [];
  const items = await db.item.findMany({
    where: { category: { in: [...categories] }, active: true },
    orderBy: [{ category: "asc" }, { code: "asc" }],
  });
  return items.map((i) => ({
    id: i.id,
    name: localName(i, locale),
    unit: i.unit,
    category: i.category,
    group: i.group,
    reorderLevel: i.reorderLevel,
  }));
}

/** id -> localised name for every item of the client (including inactive, for history). */
export async function itemNames(db: TenantDb, locale: AppLocale) {
  // Naming deletedAt (even as undefined) stops the tenant layer hiding soft-deleted items; history needs their names.
  const items = await db.item.findMany({ where: { deletedAt: undefined }, select: { id: true, nameMr: true, nameEn: true, unit: true, category: true, group: true } });
  return new Map(items.map((i) => [i.id, { name: localName(i, locale), unit: i.unit, category: i.category, group: i.group }]));
}

/** YYYY-MM for "now" in India, and the UTC date range of a YYYY-MM month. */
export function currentMonth(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7);
}
export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}
export function validMonth(v: string | undefined) {
  return v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : currentMonth();
}
export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
