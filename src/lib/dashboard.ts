import "server-only";
import { cache } from "react";
import { tenantDb, type TenantDb } from "./tenant";
import type { Session } from "./session-token";
import { stockRows } from "./stock-view";
import { todayIST } from "./entry-form";
import { dateToDay, dayToDate } from "./entries";
import { round } from "./stock";
import type { AppLocale } from "./format";

const DAY = 86400000;
const DAILY_REGISTERS = ["grain", "meals", "vegetables", "fruit"] as const;

// Shared by the KPI block and the charts, which render separately within one request.
const cachedStock = cache((clientId: string, institutionId: string, locale: AppLocale) => stockRows(tenantDb(clientId), institutionId, locale));

/** KPIs, today's tasks and low stock: the quick part of the home page. Child-identifying data is never used. */
export async function dashboardData(db: TenantDb, session: Session, locale: AppLocale) {
  const institutionId = session.institutionId!;
  const inst = { institutionId };
  const today = todayIST();
  const todayDate = dayToDate(today);
  const monthStart = dayToDate(`${today.slice(0, 7)}-01`);
  const isAdmin = session.role === "ADMIN";

  const [stock, latestCount, todayEntries, pendingEntries, pendingVisits, donationsMonth, visitsToday] = await Promise.all([
    cachedStock(session.clientId, institutionId, locale),
    db.entry.findFirst({ where: { ...inst, childCount: { not: null } }, orderBy: { date: "desc" }, select: { childCount: true } }),
    db.entry.findMany({ where: { ...inst, date: todayDate }, select: { module: true, status: true, fields: true } }),
    db.entry.findMany({
      where: { ...inst, status: "PENDING", ...(isAdmin ? {} : { createdById: session.userId }) },
      select: { id: true, module: true, date: true },
      orderBy: { date: "desc" },
    }),
    isAdmin ? db.visit.count({ where: { ...inst, status: "PENDING" } }) : Promise.resolve(0),
    db.donation.findMany({ where: { ...inst, date: { gte: monthStart }, status: { not: "REJECTED" } }, select: { amount: true } }),
    db.visit.count({ where: { ...inst, date: todayDate } }),
  ]);

  const mealToday = todayEntries.find((e) => e.module === "meals");
  const mealFields = (mealToday?.fields ?? {}) as Record<string, unknown>;
  const mealsCount = ["breakfast", "lunch", "snack", "dinner"].filter((k) => mealFields[k]).length;
  const filledToday = new Set(todayEntries.map((e) => e.module));
  const missingToday = DAILY_REGISTERS.filter((m) => !filledToday.has(m));
  const lowStock = stock.filter((s) => s.status !== "ok");

  const kpis = {
    children: latestCount?.childCount ?? null,
    lowStock: lowStock.length,
    pending: pendingEntries.length + pendingVisits,
    meals: mealsCount,
    donations: donationsMonth.length,
    donationCash: round(donationsMonth.reduce((s, d) => s + (d.amount ?? 0), 0)),
    visitorsToday: visitsToday,
  };
  return { kpis, missingToday, lowStock: lowStock.slice(0, 8), myPending: pendingEntries.slice(0, 8), filledToday: [...filledToday] };
}

/** The admin charts. Loaded after the KPIs so the page appears quickly. */
export async function dashboardCharts(db: TenantDb, session: Session, locale: AppLocale) {
  const institutionId = session.institutionId!;
  const inst = { institutionId };
  const today = todayIST();
  const todayDate = dayToDate(today);
  const monthStart = dayToDate(`${today.slice(0, 7)}-01`);
  const yearStart = dayToDate(`${today.slice(0, 4)}-01-01`);
  const since30 = new Date(todayDate.getTime() - 29 * DAY);
  const since12w = new Date(todayDate.getTime() - 83 * DAY);
  const since6m = dayToDate(new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth() - 5, 1)).toISOString().slice(0, 10));
  // Kilogram totals: movements are grouped per item and filtered to kg items in memory, so every query runs in parallel.
  const kg = { unit: "kg" };

  const [stock, kgItems, kgMoves30, kgMoves12w, vegMonth, fruit, mealEntries, visitsByDay, purposes, newRepeat, donationTypes, donationMonthly, expenses, pendingByModule, recent] = await Promise.all([
    cachedStock(session.clientId, institutionId, locale),
    db.item.findMany({ where: kg, select: { id: true, group: true } }),
    db.stockMovement.groupBy({
      by: ["date", "itemId"],
      where: { ...inst, status: "APPROVED", module: "grain", direction: "OUT", date: { gte: since30 } },
      _sum: { qty: true },
    }),
    db.stockMovement.groupBy({
      by: ["date", "direction", "itemId"],
      where: { ...inst, status: "APPROVED", date: { gte: since12w }, module: { notIn: ["vegetables", "fruit"] } },
      _sum: { qty: true },
    }),
    db.stockMovement.groupBy({
      by: ["itemId"],
      where: { ...inst, status: "APPROVED", module: "vegetables", direction: "OUT", date: { gte: monthStart } },
      _sum: { qty: true },
    }),
    db.stockMovement.groupBy({
      by: ["date", "type"],
      where: { ...inst, status: "APPROVED", module: "fruit", direction: "IN", date: { gte: since6m } },
      _sum: { qty: true },
    }),
    db.entry.findMany({ where: { ...inst, module: "meals", date: { gte: monthStart } }, select: { date: true, status: true } }),
    db.visit.groupBy({ by: ["date"], where: { ...inst, date: { gte: yearStart } }, _count: { _all: true } }),
    db.visit.groupBy({ by: ["purpose"], where: { ...inst, date: { gte: yearStart } }, _count: { _all: true } }),
    Promise.all([db.visitor.count({ where: { ...inst, visitCount: 1 } }), db.visitor.count({ where: { ...inst, visitCount: { gt: 1 } } })]),
    db.donation.groupBy({ by: ["type"], where: { ...inst, date: { gte: yearStart }, status: { not: "REJECTED" } }, _count: { _all: true } }),
    db.donation.groupBy({ by: ["date"], where: { ...inst, date: { gte: yearStart }, status: { not: "REJECTED" } }, _count: { _all: true } }),
    db.entry.findMany({ where: { ...inst, module: "expenses", status: "APPROVED", date: { gte: yearStart } }, select: { fields: true, date: true } }),
    db.entry.groupBy({ by: ["module"], where: { ...inst, status: "PENDING" }, _count: { _all: true } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { user: { select: { name: true } } } }),
  ]);
  const groupOf = new Map(kgItems.map((i) => [i.id, i.group]));

  // Daily consumption (kg) with a 7-day moving average.
  const consMap = new Map<string, number>();
  for (const c of kgMoves30) if (groupOf.has(c.itemId)) consMap.set(dateToDay(c.date), (consMap.get(dateToDay(c.date)) ?? 0) + (c._sum.qty ?? 0));
  const consDays = Array.from({ length: 30 }, (_, i) => dateToDay(new Date(since30.getTime() + i * DAY)));
  const consumptionSeries = consDays.map((d, i) => {
    const window = consDays.slice(Math.max(0, i - 6), i + 1).map((x) => consMap.get(x) ?? 0);
    return { day: d, daily: round(consMap.get(d) ?? 0), avg7: round(window.reduce((a, b) => a + b, 0) / window.length) };
  });

  // Weekly stock in vs out (kg).
  const weekOf = (d: Date) => dateToDay(new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY));
  const weeks = new Map<string, { week: string; in: number; out: number }>();
  for (let i = 0; i < 12; i++) {
    const w = weekOf(new Date(since12w.getTime() + i * 7 * DAY));
    weeks.set(w, { week: w, in: 0, out: 0 });
  }
  for (const r of kgMoves12w) {
    if (!groupOf.has(r.itemId)) continue;
    const w = weeks.get(weekOf(r.date));
    if (w) w[r.direction === "IN" ? "in" : "out"] = round(w[r.direction === "IN" ? "in" : "out"] + (r._sum.qty ?? 0));
  }

  const veg = new Map<string, number>([["LEAFY", 0], ["FRUIT_VEG", 0], ["ROOTS", 0], ["MASALA", 0]]);
  for (const v of vegMonth) {
    const g = groupOf.get(v.itemId);
    if (g) veg.set(g, round((veg.get(g) ?? 0) + (v._sum.qty ?? 0)));
  }

  const fruitMonths = new Map<string, { month: string; purchased: number; donated: number }>();
  for (let i = 0; i < 6; i++) {
    const m = new Date(Date.UTC(since6m.getUTCFullYear(), since6m.getUTCMonth() + i, 1)).toISOString().slice(0, 7);
    fruitMonths.set(m, { month: m, purchased: 0, donated: 0 });
  }
  for (const f of fruit) {
    const m = fruitMonths.get(dateToDay(f.date).slice(0, 7));
    if (m) m[f.type === "donation" ? "donated" : "purchased"] = round(m[f.type === "donation" ? "donated" : "purchased"] + (f._sum.qty ?? 0));
  }

  // Meal completeness for each day of this month so far.
  const mealDays = Array.from({ length: Number(today.slice(8, 10)) }, (_, i) => `${today.slice(0, 7)}-${String(i + 1).padStart(2, "0")}`);
  const mealByDay = new Map(mealEntries.map((e) => [dateToDay(e.date), e.status]));
  const mealCompleteness = mealDays.map((d) => ({ day: d, state: mealByDay.get(d) === "APPROVED" ? "approved" : mealByDay.has(d) ? "filled" : "missing" }));

  const visitsMonthly = new Map<string, number>();
  const weekday = Array(7).fill(0) as number[];
  for (const v of visitsByDay) {
    const m = dateToDay(v.date).slice(0, 7);
    visitsMonthly.set(m, (visitsMonthly.get(m) ?? 0) + v._count._all);
    weekday[v.date.getUTCDay()] += v._count._all;
  }
  const donationsByMonth = new Map<string, number>();
  for (const d of donationMonthly) donationsByMonth.set(dateToDay(d.date).slice(0, 7), (donationsByMonth.get(dateToDay(d.date).slice(0, 7)) ?? 0) + d._count._all);
  const expenseCats = new Map<string, number>();
  for (const e of expenses) {
    const f = (e.fields ?? {}) as Record<string, unknown>;
    const c = String(f.category ?? "OTHER");
    expenseCats.set(c, round((expenseCats.get(c) ?? 0) + Number(f.total ?? 0)));
  }

  const sortedPurposes = purposes
    .map((p) => ({ purpose: p.purpose ?? "NONE", count: p._count._all }))
    .sort((a, b) => b.count - a.count);
  const topPurposes = sortedPurposes.slice(0, 10);
  const otherCount = sortedPurposes.slice(10).reduce((s, p) => s + p.count, 0);

  return {
    stockLevels: stock
      .filter((s) => s.reorderLevel)
      .sort((a, b) => a.balance / (a.reorderLevel || 1) - b.balance / (b.reorderLevel || 1))
      .slice(0, 12)
      .map((s) => ({ name: s.name, unit: s.unit, balance: s.balance, reorder: s.reorderLevel ?? 0, alert: s.status !== "ok" })),
    daysLeft: stock
      .filter((s) => s.daysLeft !== null)
      .sort((a, b) => a.daysLeft! - b.daysLeft!)
      .slice(0, 10)
      .map((s) => ({ name: s.name, days: s.daysLeft!, alert: s.daysLeft! <= 7 })),
    consumption: consumptionSeries,
    inOut: [...weeks.values()],
    vegGroups: [...veg].map(([group, kg]) => ({ group, kg })),
    fruit: [...fruitMonths.values()],
    mealCompleteness,
    visitsMonthly: [...visitsMonthly].sort().map(([month, count]) => ({ month, count })),
    weekday,
    purposes: otherCount ? [...topPurposes, { purpose: "OTHER_REST", count: otherCount }] : topPurposes,
    newRepeat: { new: newRepeat[0], repeat: newRepeat[1] },
    donationTypes: donationTypes.map((d) => ({ type: d.type, count: d._count._all })).sort((a, b) => b.count - a.count),
    donationsMonthly: [...donationsByMonth].sort().map(([month, count]) => ({ month, count })),
    expenses: [...expenseCats].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total),
    pendingByModule: pendingByModule.map((p) => ({ module: p.module, count: p._count._all })).sort((a, b) => b.count - a.count),
    recent: recent.map((r) => ({ id: r.id, at: r.createdAt, who: r.user?.name ?? null, action: r.action, entity: r.entity })),
  };
}

export type DashboardData = Awaited<ReturnType<typeof dashboardData>>;
export type DashboardCharts = Awaited<ReturnType<typeof dashboardCharts>>;
