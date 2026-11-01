// Parses and validates a submitted register entry against its register config. Pure (tested).
import { IN_KINDS, MODULES, type ModuleKey, type Role } from "./modules.ts";

export type LineInput = {
  itemId: string;
  inQty: number | null;
  outQty: number | null;
  kind: string | null;
  source: string | null;
  donorName: string | null;
  rate: number | null;
  amount: number | null;
  expiryDate: string | null;
  acknowledged: boolean | null;
  note: string | null;
};

export type EntryInput = {
  date: string;
  childCount: number | null;
  fields: Record<string, string | number | null>;
  lines: LineInput[];
  remarks: string | null;
};

export type ParseOutcome = { ok: true; data: EntryInput } | { ok: false; errors: Record<string, string> };

const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown): number | null | "bad" => {
  const t = s(v);
  if (!t) return null;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : "bad";
};

/** `raw` is the nested object from formToObject(); `today` is YYYY-MM-DD in India time. */
export function parseEntry(module: ModuleKey, raw: Record<string, unknown>, role: Role, today: string): ParseOutcome {
  const cfg = MODULES[module];
  const errors: Record<string, string> = {};

  const date = s(raw.date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.date = "required";
  else if (date > today) errors.date = "entries.futureDate";

  let childCount: number | null = null;
  if (cfg.childCount) {
    const c = num(raw.childCount);
    if (c === null) errors.childCount = "required";
    else if (c === "bad" || !Number.isInteger(c) || c < 0 || c > 1000) errors.childCount = "invalid";
    else childCount = c;
  }

  const fieldsRaw = (raw.fields ?? {}) as Record<string, unknown>;
  const fields: Record<string, string | number | null> = {};
  for (const f of cfg.header) {
    if (f.adminOnly && role !== "ADMIN") continue;
    const key = `fields.${f.name}`;
    if (f.type === "number") {
      const n = num(fieldsRaw[f.name]);
      if (n === "bad" || (typeof n === "number" && n < 0)) errors[key] = "invalid";
      else fields[f.name] = n;
    } else {
      const v = s(fieldsRaw[f.name]);
      if (f.type === "select" && v && !f.options?.includes(v)) errors[key] = "invalid";
      else if (f.type === "date" && v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) errors[key] = "invalid";
      else if (v.length > 2000) errors[key] = "tooLong:2000";
      else fields[f.name] = v || null;
    }
    if (f.required && (fields[f.name] === null || fields[f.name] === undefined) && !errors[key]) {
      // Expenses: total can be worked out from rate x headcount.
      if (!(module === "expenses" && f.name === "total")) errors[key] = "required";
    }
  }
  if (module === "expenses" && !errors["fields.total"]) {
    const rate = fields.perHeadRate, count = fields.headcount;
    if (fields.total == null && typeof rate === "number" && typeof count === "number") fields.total = rate * count;
    if (fields.total == null) errors["fields.total"] = "required";
  }
  if (module === "meals" && !cfg.header.some((f) => fields[f.name])) errors["fields.breakfast"] = "entries.mealRequired";

  const lines: LineInput[] = [];
  if (cfg.lineMode !== "none") {
    const rawLines = raw.lines && typeof raw.lines === "object" ? Object.entries(raw.lines as Record<string, Record<string, unknown>>) : [];
    rawLines.sort((a, b) => Number(a[0]) - Number(b[0]));
    for (const [idx, l] of rawLines) {
      const p = `lines.${idx}`;
      const itemId = s(l.itemId);
      const inQ = num(l.inQty), outQ = num(l.outQty), qty = num(l.qty), rate = num(l.rate);
      const empty = !itemId && inQ === null && outQ === null && qty === null;
      if (empty) continue;
      if (!itemId) errors[`${p}.itemId`] = "required";
      for (const [k, v] of [["inQty", inQ], ["outQty", outQ], ["qty", qty], ["rate", rate]] as const) {
        if (v === "bad" || (typeof v === "number" && v < 0)) errors[`${p}.${k}`] = "invalid";
      }
      const kind = s(l.kind) || null;
      if (cfg.lineMode === "kind" && (!kind || !cfg.kinds?.includes(kind))) errors[`${p}.kind`] = "required";
      const source = s(l.source) || null;
      if (source && source !== "purchased" && source !== "donated") errors[`${p}.source`] = "invalid";

      // Normalise to inQty/outQty according to the line mode; a single "qty" input is used where there is one number.
      let inQty = typeof inQ === "number" ? inQ : null;
      let outQty = typeof outQ === "number" ? outQ : null;
      const q = typeof qty === "number" ? qty : null;
      if (cfg.lineMode === "sameday") {
        inQty = q;
        outQty = q;
      }
      if (cfg.lineMode === "out") outQty = q ?? outQty;
      if (cfg.lineMode === "kind") {
        const isIn = kind ? IN_KINDS.has(kind) : false;
        inQty = isIn ? q : null;
        outQty = isIn ? null : q;
      }
      if (!(inQty && inQty > 0) && !(outQty && outQty > 0) && !Object.keys(errors).some((k) => k.startsWith(`${p}.`))) {
        errors[`${p}.${cfg.lineMode === "inout" ? "inQty" : "qty"}`] = "entries.qtyRequired";
      }
      const r = typeof rate === "number" ? rate : null;
      lines.push({
        itemId,
        inQty,
        outQty,
        kind,
        source: cfg.lineExtras.includes("source") ? source ?? "purchased" : null,
        donorName: s(l.donorName) || null,
        rate: r,
        amount: r !== null && (inQty ?? outQty) ? Math.round(r * (inQty ?? outQty ?? 0) * 100) / 100 : null,
        expiryDate: /^\d{4}-\d{2}-\d{2}$/.test(s(l.expiryDate)) ? s(l.expiryDate) : null,
        acknowledged: cfg.lineExtras.includes("acknowledged") ? l.acknowledged === "on" || l.acknowledged === "true" : null,
        note: s(l.note).slice(0, 500) || null,
      });
    }
    if (lines.length === 0 && !Object.keys(errors).some((k) => k.startsWith("lines."))) errors.lines = "entries.lineRequired";
    const ids = lines.map((l) => l.itemId).filter(Boolean);
    if (cfg.lineMode !== "kind" && new Set(ids).size !== ids.length) errors.lines = "entries.duplicateItem";
  }

  const remarks = s(raw.remarks).slice(0, 2000) || null;
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, data: { date, childCount, fields, lines, remarks } };
}

/** Today's date (YYYY-MM-DD) in India. */
export function todayIST(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
