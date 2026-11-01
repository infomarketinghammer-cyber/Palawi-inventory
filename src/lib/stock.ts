// Stock ledger maths. Pure functions (unit tested in stock.test.ts).
import { IN_KINDS, kindToType, MODULES, type ModuleKey } from "./modules.ts";

export type Line = {
  itemId?: string | null;
  inQty?: number | null;
  outQty?: number | null;
  kind?: string | null;
  source?: string | null;
};

export type Movement = { itemId: string; qty: number; direction: "IN" | "OUT"; type: string };

/** Turns a register entry's lines into stock-ledger movements according to the register's line mode. */
export function linesToMovements(module: ModuleKey, lines: Line[]): Movement[] {
  const mode = MODULES[module].lineMode;
  const out: Movement[] = [];
  for (const l of lines) {
    if (!l.itemId) continue;
    const inQty = l.inQty ?? 0;
    const outQty = l.outQty ?? 0;
    switch (mode) {
      case "inout":
        if (inQty > 0) out.push({ itemId: l.itemId, qty: inQty, direction: "IN", type: "purchase" });
        if (outQty > 0) out.push({ itemId: l.itemId, qty: outQty, direction: "OUT", type: "consumption" });
        break;
      case "sameday": {
        const qty = outQty || inQty;
        if (qty > 0) {
          out.push({ itemId: l.itemId, qty, direction: "IN", type: l.source === "donated" ? "donation" : "purchase" });
          out.push({ itemId: l.itemId, qty, direction: "OUT", type: "consumption" });
        }
        break;
      }
      case "out":
        if (outQty > 0) out.push({ itemId: l.itemId, qty: outQty, direction: "OUT", type: "distribution" });
        break;
      case "kind": {
        const kind = l.kind ?? "";
        const isIn = IN_KINDS.has(kind);
        const qty = isIn ? inQty : outQty;
        if (qty > 0) out.push({ itemId: l.itemId, qty, direction: isIn ? "IN" : "OUT", type: kindToType(kind) });
        break;
      }
      case "none":
        break;
    }
  }
  return out;
}

export type Balance = { approved: number; pendingIn: number; pendingOut: number };

/** Sums ledger rows into balances per item. Rejected rows are ignored. */
export function computeBalances(
  rows: { itemId: string; qty: number; direction: "IN" | "OUT"; status: string }[],
): Map<string, Balance> {
  const map = new Map<string, Balance>();
  for (const r of rows) {
    const b = map.get(r.itemId) ?? { approved: 0, pendingIn: 0, pendingOut: 0 };
    if (r.status === "APPROVED") b.approved += r.direction === "IN" ? r.qty : -r.qty;
    else if (r.status === "PENDING") {
      if (r.direction === "IN") b.pendingIn += r.qty;
      else b.pendingOut += r.qty;
    }
    map.set(r.itemId, b);
  }
  for (const b of map.values()) {
    b.approved = round(b.approved);
    b.pendingIn = round(b.pendingIn);
    b.pendingOut = round(b.pendingOut);
  }
  return map;
}

export type Shortage = { itemId: string; need: number; available: number };

/**
 * Items whose net OUT in `movements` exceeds what is available.
 * `available(itemId)` is the stock the caller allows to be used (approved balance at approval time,
 * or approved + pending-in − other pending-out at entry time).
 */
export function findShortages(movements: Movement[], available: (itemId: string) => number): Shortage[] {
  const net = new Map<string, number>();
  for (const m of movements) net.set(m.itemId, (net.get(m.itemId) ?? 0) + (m.direction === "OUT" ? m.qty : -m.qty));
  const out: Shortage[] = [];
  for (const [itemId, need] of net) {
    if (need <= 0) continue;
    const avail = available(itemId);
    if (round(need) > round(avail)) out.push({ itemId, need: round(need), available: round(avail) });
  }
  return out;
}

export type StockStatus = "ok" | "low" | "out";

export function stockStatus(balance: number, reorderLevel: number | null | undefined): StockStatus {
  if (balance <= 0) return "out";
  if (reorderLevel != null && balance <= reorderLevel) return "low";
  return "ok";
}

/** Days until stock-out at the average daily consumption, or null if there is no consumption. */
export function daysOfStock(balance: number, consumedLastNDays: number, days: number): number | null {
  if (consumedLastNDays <= 0 || days <= 0) return null;
  return Math.max(0, Math.floor(balance / (consumedLastNDays / days)));
}

export function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
