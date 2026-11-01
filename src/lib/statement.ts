import "server-only";
import type { TenantDb } from "./tenant";
import { round } from "./stock";
import { localName, type AppLocale } from "./format";
import { monthRange } from "./ui-data";

export type StatementRow = { id: string; name: string; unit: string; category: string; opening: number; received: number; consumed: number; closing: number };

/** Monthly stock statement per item from approved ledger rows: opening, received, consumed, closing. */
export async function monthlyStatement(db: TenantDb, institutionId: string, month: string, locale: AppLocale): Promise<StatementRow[]> {
  const { start, end } = monthRange(month);
  const [items, before, during] = await Promise.all([
    db.item.findMany({ where: { category: { notIn: ["VEGETABLE", "FRUIT"] } }, orderBy: [{ category: "asc" }, { code: "asc" }] }),
    db.stockMovement.groupBy({ by: ["itemId", "direction"], where: { institutionId, status: "APPROVED", date: { lt: start } }, _sum: { qty: true } }),
    db.stockMovement.groupBy({ by: ["itemId", "direction"], where: { institutionId, status: "APPROVED", date: { gte: start, lt: end } }, _sum: { qty: true } }),
  ]);
  const sum = (rows: typeof before, id: string, dir: "IN" | "OUT") => rows.find((r) => r.itemId === id && r.direction === dir)?._sum.qty ?? 0;
  return items
    .map((i) => {
      const opening = round(sum(before, i.id, "IN") - sum(before, i.id, "OUT"));
      const received = round(sum(during, i.id, "IN"));
      const consumed = round(sum(during, i.id, "OUT"));
      return { id: i.id, name: localName(i, locale), unit: i.unit, category: i.category, opening, received, consumed, closing: round(opening + received - consumed) };
    })
    .filter((r) => r.opening || r.received || r.consumed);
}
