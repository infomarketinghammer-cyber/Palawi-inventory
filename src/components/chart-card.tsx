"use client";

import { useState } from "react";
import { Download, Table2, BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ALERT, AXIS, GRID, SERIES } from "@/lib/chart-colors";
import { Card } from "./ui/card";
import { ScrollX } from "./ui/scroll-x";

export type ChartRow = { label: string; alert?: boolean } & Record<string, string | number | boolean | undefined>;
export type Series = { key: string; label: string };

/**
 * One chart with its table view and CSV export. At most two series (validated colour pair).
 * hbar rows with `alert` use the red alert colour (status), named in the table too.
 */
export function ChartCard({
  title,
  kind,
  rows,
  series,
  unit,
  labels,
  alertLabel,
}: {
  title: string;
  kind: "bar" | "hbar" | "line";
  rows: ChartRow[];
  series: Series[];
  unit?: string;
  labels: { table: string; chart: string; csv: string; noData: string; item: string };
  alertLabel?: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const empty = rows.length === 0 || rows.every((r) => series.every((s) => !Number(r[s.key])));
  const fmt = (v: unknown) => (typeof v === "number" ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(v) : String(v ?? ""));

  const downloadCsv = () => {
    const head = [labels.item, ...series.map((s) => s.label)];
    const body = rows.map((r) => [r.label, ...series.map((s) => r[s.key] ?? "")]);
    const csv = [head, ...body].map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `${title.replace(/[^\p{L}\p{N}]+/gu, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const height = kind === "hbar" ? Math.max(180, rows.length * 30 + 40) : 240;
  const tooltip = (
    <Tooltip
      cursor={{ fill: GRID, stroke: GRID }}
      formatter={(v: number, name: string) => [`${fmt(v)}${unit ? ` ${unit}` : ""}`, name]}
      contentStyle={{ borderRadius: 12, borderColor: GRID, fontSize: 13 }}
    />
  );

  return (
    <Card className="flex flex-col gap-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-primary-800">
          {title}
          {unit && <span className="font-normal text-ink-muted"> ({unit})</span>}
        </h3>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={() => setView(view === "chart" ? "table" : "chart")}
            className="flex size-9 items-center justify-center rounded-lg text-primary-800 hover:bg-primary-50"
            aria-label={view === "chart" ? labels.table : labels.chart}
            title={view === "chart" ? labels.table : labels.chart}
          >
            {view === "chart" ? <Table2 size={18} aria-hidden /> : <BarChart3 size={18} aria-hidden />}
          </button>
          <button type="button" onClick={downloadCsv} className="flex size-9 items-center justify-center rounded-lg text-primary-800 hover:bg-primary-50" aria-label={labels.csv} title={labels.csv}>
            <Download size={18} aria-hidden />
          </button>
        </div>
      </div>

      {empty ? (
        <p className="py-8 text-center text-ink-muted">{labels.noData}</p>
      ) : view === "table" ? (
        <ScrollX className="max-h-80 overflow-y-auto">
          <table className="w-full whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b border-primary-100 text-left">
                <th scope="col" className="py-1 pr-2">{labels.item}</th>
                {series.map((s) => (
                  <th key={s.key} scope="col" className="py-1 pr-2 text-right">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-primary-50">
                  <td className="py-1 pr-2">
                    {r.label}
                    {r.alert && alertLabel && <span className="ml-1 font-medium text-alert-700">⚠ {alertLabel}</span>}
                  </td>
                  {series.map((s) => (
                    <td key={s.key} className="py-1 pr-2 text-right tabular-nums">{fmt(r[s.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
      ) : (
        <div style={{ height }} role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height="100%">
            {kind === "line" ? (
              <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={16} />
                <YAxis tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={false} />
                {tooltip}
                {series.length > 1 && <Legend wrapperStyle={{ fontSize: 13, color: AXIS }} />}
                {series.map((s, i) => (
                  <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={SERIES[i]} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} strokeDasharray={i === 1 ? "6 4" : undefined} />
                ))}
              </LineChart>
            ) : kind === "hbar" ? (
              <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }} barCategoryGap={6}>
                <CartesianGrid stroke={GRID} horizontal={false} />
                <XAxis type="number" tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="label" width={130} tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={false} />
                {tooltip}
                {series.length > 1 && <Legend wrapperStyle={{ fontSize: 13, color: AXIS }} />}
                {series.map((s, i) => (
                  <Bar key={s.key} dataKey={s.key} name={s.label} fill={SERIES[i]} radius={[0, 4, 4, 0]} stroke="#fff" strokeWidth={2}>
                    {i === 0 && rows.map((r) => <Cell key={r.label} fill={r.alert ? ALERT : SERIES[0]} />)}
                  </Bar>
                ))}
              </BarChart>
            ) : (
              <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }} barGap={2}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                {tooltip}
                {series.length > 1 && <Legend wrapperStyle={{ fontSize: 13, color: AXIS }} />}
                {series.map((s, i) => (
                  <Bar key={s.key} dataKey={s.key} name={s.label} fill={SERIES[i]} radius={[4, 4, 0, 0]} stroke="#fff" strokeWidth={2} maxBarSize={36} />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
