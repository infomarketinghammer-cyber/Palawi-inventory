import "server-only";
import type { TenantDb } from "./tenant";
import { getBalances } from "./entries";
import { daysOfStock, round, stockStatus, type StockStatus } from "./stock";
import { localName, type AppLocale } from "./format";

export type StockRow = {
  id: string;
  name: string;
  unit: string;
  category: string;
  reorderLevel: number | null;
  balance: number;
  pendingIn: number;
  pendingOut: number;
  status: StockStatus;
  daysLeft: number | null;
  /** Approved consumption + issues over the last 30 days (drives days-of-stock). */
  consumed30: number;
};

/** Current stock for every active item that holds stock (vegetables/fruit are bought and used daily). */
export async function stockRows(db: TenantDb, institutionId: string, locale: AppLocale): Promise<StockRow[]> {
  const since = new Date(Date.now() - 30 * 86400000);
  const [items, bal, used] = await Promise.all([
    db.item.findMany({ where: { active: true, category: { notIn: ["VEGETABLE", "FRUIT"] } }, orderBy: [{ category: "asc" }, { code: "asc" }] }),
    getBalances(db, institutionId),
    db.stockMovement.groupBy({
      by: ["itemId"],
      where: { institutionId, status: "APPROVED", direction: "OUT", type: { in: ["consumption", "distribution"] }, date: { gte: since } },
      _sum: { qty: true },
    }),
  ]);
  const usedMap = new Map(used.map((u) => [u.itemId, u._sum.qty ?? 0]));
  return items.map((i) => {
    const b = bal.get(i.id) ?? { approved: 0, pendingIn: 0, pendingOut: 0 };
    const consumed30 = round(usedMap.get(i.id) ?? 0);
    return {
      id: i.id,
      name: localName(i, locale),
      unit: i.unit,
      category: i.category,
      reorderLevel: i.reorderLevel,
      balance: b.approved,
      pendingIn: b.pendingIn,
      pendingOut: b.pendingOut,
      status: stockStatus(b.approved, i.reorderLevel),
      daysLeft: daysOfStock(b.approved, consumed30, 30),
      consumed30,
    };
  });
}
