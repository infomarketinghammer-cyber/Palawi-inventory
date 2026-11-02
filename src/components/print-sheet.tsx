import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "./ui/button";
import { PrintButton } from "./print-button";
import { ScrollX } from "./ui/scroll-x";

/** Paper-register style sheet: institution heading, register title, month, bordered table. */
export function PrintSheet({
  institution,
  title,
  subtitle,
  printedOn,
  columns,
  rows,
  empty,
  printLabel,
  backHref,
  backLabel,
}: {
  institution: string;
  title: string;
  subtitle: string;
  printedOn: string;
  columns: string[];
  rows: string[][];
  empty: string;
  printLabel: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 print:hidden">
        <Link href={backHref} className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft size={16} aria-hidden />
          {backLabel}
        </Link>
        <PrintButton label={printLabel} />
      </div>
      <article className="rounded-card border border-primary-100 bg-white p-4 print:border-0 print:p-0">
        <header className="mb-4 text-center">
          <p className="text-xl font-bold text-ink">{institution}</p>
          <h1 className="text-lg font-semibold text-ink">{title}</h1>
          <p className="text-ink">{subtitle}</p>
        </header>
        {rows.length === 0 ? (
          <p className="text-center text-ink-muted">{empty}</p>
        ) : (
          <ScrollX>
            <table className="w-full border-collapse text-sm print:text-xs">
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c} scope="col" className="whitespace-nowrap border border-ink px-2 py-1 text-left font-semibold print:whitespace-normal">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="break-inside-avoid">
                    {r.map((cell, j) => (
                      <td key={j} className="border border-ink px-2 py-1 align-top">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
        )}
        <p className="mt-4 text-right text-xs text-ink-muted">{printedOn}</p>
      </article>
    </div>
  );
}
