import "server-only";
import { getTranslations } from "next-intl/server";
import { MODULES, type ModuleKey } from "./modules";
import { formatINR, formatNumber, type NumeralStyle } from "./format";

type Names = Map<string, { name: string; unit: string; category: string; group: string | null }>;
type EntryLike = { module: string; fields: unknown; lines: { itemId: string | null; inQty: number | null; outQty: number | null; kind: string | null; source: string | null }[] };

/** One-line summary of an entry for lists and approval queues. */
export async function summarise(e: EntryLike, names: Names, numerals: NumeralStyle): Promise<string> {
  const t = await getTranslations();
  const cfg = MODULES[e.module as ModuleKey];
  const f = (e.fields ?? {}) as Record<string, string | number | null>;
  if (e.module === "meals") {
    return ["breakfast", "lunch", "snack", "dinner"]
      .filter((k) => f[k])
      .map((k) => `${t(`entries.fields.${k}`)}: ${f[k]}`)
      .join(" · ");
  }
  if (e.module === "expenses") return `${f.description ?? ""} — ${formatINR(Number(f.total ?? 0), { numerals })}`;
  const qty = (n: number | null) => formatNumber(n ?? 0, { numerals });
  const parts = e.lines.map((l) => {
    const it = l.itemId ? names.get(l.itemId) : undefined;
    const unit = it ? t(`units.${it.unit}`) : "";
    const name = it?.name ?? "?";
    if (cfg.lineMode === "kind") return `${t(`kinds.${l.kind}`)}: ${name} ${qty(l.inQty ?? l.outQty)} ${unit}`;
    return `${name} ${qty(cfg.lineMode === "out" ? l.outQty : l.outQty ?? l.inQty)} ${unit}`;
  });
  return parts.slice(0, 4).join(", ") + (parts.length > 4 ? ` +${parts.length - 4}` : "");
}
