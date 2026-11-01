import { SEQUENTIAL } from "@/lib/chart-colors";
import { Card } from "./ui/card";

/** A row of labelled cells shaded by a sequential teal ramp; every cell also prints its value. */
export function HeatStrip({
  title,
  cells,
  legend,
}: {
  title: string;
  cells: { key: string; label: string; value: string; level: number; title: string }[];
  legend?: { label: string; level: number }[];
}) {
  const bg = (level: number) => SEQUENTIAL[Math.max(0, Math.min(SEQUENTIAL.length - 1, level))];
  const ink = (level: number) => (level >= 4 ? "#ffffff" : "#1b372c");
  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <h3 className="font-semibold text-primary-800">{title}</h3>
      <ul className="flex flex-wrap gap-1">
        {cells.map((c) => (
          <li
            key={c.key}
            title={c.title}
            className="flex min-w-11 flex-col items-center rounded-lg px-1.5 py-1 text-xs"
            style={{ background: bg(c.level), color: ink(c.level) }}
          >
            <span className="font-semibold">{c.label}</span>
            <span>{c.value}</span>
          </li>
        ))}
      </ul>
      {legend && (
        <ul className="flex flex-wrap gap-3 text-sm text-ink-muted">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1">
              <span className="inline-block size-3 rounded-sm border border-primary-200" style={{ background: bg(l.level) }} aria-hidden />
              {l.label}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
