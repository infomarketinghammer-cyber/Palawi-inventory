import "server-only";
import { getTranslations } from "next-intl/server";
import { tenantDb } from "./tenant";
import { MODULES, type ModuleKey } from "./modules";
import { getBalances } from "./entries";
import { itemNames, monthRange } from "./ui-data";
import { formatDate, formatDateTime, formatINR, formatNumber, type AppLocale, type NumeralStyle } from "./format";
import { round } from "./stock";
import type { Session } from "./session-token";

export type Report = { title: string; columns: string[]; rows: string[][] };

/** Rows of a monthly register, mirroring the paper book. Used by the print view and the Excel export. */
export async function registerReport(session: Session, module: ModuleKey, month: string, locale: AppLocale, numerals: NumeralStyle): Promise<Report> {
  const t = await getTranslations({ locale });
  const db = tenantDb(session.clientId);
  const cfg = MODULES[module];
  const { start, end } = monthRange(month);
  const where = { module, date: { gte: start, lt: end }, ...(session.institutionId ? { institutionId: session.institutionId } : {}) };
  const entries = await db.entry.findMany({ where, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
  const names = await itemNames(db, locale);
  const n = (v: number | null | undefined) => (v == null ? "" : formatNumber(v, { numerals }));
  const d = (v: Date) => formatDate(v, { numerals });
  const approval = (e: (typeof entries)[number]) =>
    e.status === "APPROVED" && e.approvedByName && e.approvedAt
      ? t("entries.approvedBy", { name: e.approvedByName, date: formatDateTime(e.approvedAt, { numerals }) })
      : t(`status.${e.status}`);
  const item = (id: string | null) => {
    const it = id ? names.get(id) : undefined;
    return it ? `${it.name} (${t(`units.${it.unit}`)})` : "";
  };
  const title = t(`modules.${module}`);

  if (module === "meals") {
    return {
      title,
      columns: [t("entries.date"), t("entries.childCount"), ...cfg.header.map((f) => t(`entries.fields.${f.name}`)), t("entries.remarks"), t("entries.createdBy"), t("entries.approval")],
      rows: entries.map((e) => {
        const f = (e.fields ?? {}) as Record<string, unknown>;
        return [d(e.date), n(e.childCount), ...cfg.header.map((h) => String(f[h.name] ?? "")), e.remarks ?? "", e.createdByName, approval(e)];
      }),
    };
  }
  if (module === "expenses") {
    return {
      title,
      columns: [t("entries.date"), ...cfg.header.map((f) => t(`entries.fields.${f.name}`)), t("entries.createdBy"), t("entries.approval")],
      rows: entries.map((e) => {
        const f = (e.fields ?? {}) as Record<string, string | number | null>;
        return [
          d(e.date),
          ...cfg.header.map((h) =>
            f[h.name] == null ? "" : h.type === "select" ? t(`expenseCategories.${f[h.name]}`) : h.name === "total" || h.name === "perHeadRate" ? formatINR(Number(f[h.name]), { numerals }) : String(f[h.name]),
          ),
          e.createdByName,
          approval(e),
        ];
      }),
    };
  }

  // Item registers: one row per line. Running balance (approved only) for registers that take from stock.
  // Stock arrives through other registers (mainly Stock in), so their approved movements in the month are
  // applied in date order too: the morning's purchase shows up in the opening of that day's consumption.
  const running = new Map<string, number>();
  const holdsStock = cfg.lineMode === "out";
  const others: { itemId: string; qty: number; direction: string; date: Date; createdAt: Date }[] = [];
  if (holdsStock && session.institutionId) {
    const [before, moves] = await Promise.all([
      getBalances(db, session.institutionId, { before: start }),
      db.stockMovement.findMany({
        where: { institutionId: session.institutionId, status: "APPROVED", module: { not: module }, date: { gte: start, lt: end } },
        select: { itemId: true, qty: true, direction: true, date: true, createdAt: true },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
    ]);
    for (const [id, b] of before) running.set(id, b.approved);
    others.push(...moves);
  }
  let next = 0;
  const applyOthersBefore = (date: Date, createdAt: Date) => {
    while (next < others.length && (others[next].date < date || (+others[next].date === +date && others[next].createdAt < createdAt))) {
      const m = others[next++];
      running.set(m.itemId, round((running.get(m.itemId) ?? 0) + (m.direction === "IN" ? m.qty : -m.qty)));
    }
  };
  const header = [cfg.childCount ? t("entries.childCount") : null, ...cfg.header.filter((h) => !h.adminOnly).map((h) => t(`entries.fields.${h.name}`))].filter(Boolean) as string[];
  const columns = [
    t("entries.date"),
    ...header,
    t("entries.item"),
    ...(cfg.lineMode === "kind" ? [t("entries.kind")] : []),
    ...(holdsStock ? [t("entries.opening")] : []),
    t(cfg.qtyLabel ?? "entries.qty"),
    ...(holdsStock ? [t("entries.balance")] : []),
    ...(cfg.lineExtras.includes("source") ? [t("entries.source")] : []),
    ...(module === "cleaning" ? [t("entries.medicalVerification")] : []),
    t("entries.approval"),
  ];
  const rows: string[][] = [];
  for (const e of entries) {
    const f = (e.fields ?? {}) as Record<string, unknown>;
    const headVals = [cfg.childCount ? n(e.childCount) : null, ...cfg.header.filter((h) => !h.adminOnly).map((h) => String(f[h.name] ?? ""))].filter((v) => v !== null) as string[];
    applyOthersBefore(e.date, e.createdAt);
    for (const l of e.lines) {
      const open = l.itemId ? running.get(l.itemId) ?? 0 : 0;
      const bal = round(open - (l.outQty ?? 0));
      if (holdsStock && e.status === "APPROVED" && l.itemId) running.set(l.itemId, bal);
      rows.push([
        d(e.date),
        ...headVals,
        item(l.itemId),
        ...(cfg.lineMode === "kind" ? [t(`kinds.${l.kind}`)] : []),
        ...(holdsStock ? [n(open)] : []),
        n(cfg.lineMode === "out" ? l.outQty : l.inQty ?? l.outQty),
        ...(holdsStock ? [e.status === "APPROVED" ? n(bal) : ""] : []),
        ...(cfg.lineExtras.includes("source") ? [t(`sources.${l.source ?? "purchased"}`) + (l.donorName ? ` — ${l.donorName}` : "")] : []),
        ...(module === "cleaning" ? [f.medicalOfficerName ? t("entries.medicalVerified", { name: String(f.medicalOfficerName), date: f.medicalOfficerDate ? formatDate(`${f.medicalOfficerDate}T00:00:00Z`, { numerals }) : "" }) : ""] : []),
        approval(e),
      ]);
    }
  }
  return { title, columns, rows };
}
