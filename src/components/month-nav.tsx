import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { shiftMonth } from "@/lib/ui-data";

/** Previous / next month links around a label like "10/2026". `extra` keeps other query params. */
export function MonthNav({ base, month, label, extra = "" }: { base: string; month: string; label: string; extra?: string }) {
  const link = (m: string) => `${base}?month=${m}${extra}`;
  return (
    <nav className="flex items-center gap-1" aria-label={label}>
      <Link href={link(shiftMonth(month, -1))} className="flex size-11 items-center justify-center rounded-xl border border-primary-200 bg-white text-primary-800 hover:bg-primary-50" aria-label="‹">
        <ChevronLeft aria-hidden />
      </Link>
      <span className="min-w-28 text-center font-semibold text-primary-800">{label}</span>
      <Link href={link(shiftMonth(month, 1))} className="flex size-11 items-center justify-center rounded-xl border border-primary-200 bg-white text-primary-800 hover:bg-primary-50" aria-label="›">
        <ChevronRight aria-hidden />
      </Link>
    </nav>
  );
}

export function monthLabel(month: string, numerals: "latin" | "deva") {
  const [y, m] = month.split("-");
  const s = `${m}/${y}`;
  return numerals === "deva" ? s.replace(/[0-9]/g, (d) => "०१२३४५६७८९"[Number(d)]) : s;
}
