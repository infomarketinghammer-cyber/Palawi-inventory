import { ScrollX } from "./scroll-x";

/** Responsive table: slides left/right inside its card on narrow screens, never the page. */
export function DataTable({
  columns,
  rows,
  empty,
}: {
  columns: string[];
  rows: { key: string; cells: React.ReactNode[] }[];
  empty: string;
}) {
  if (rows.length === 0) return <p className="p-4 text-ink-muted sm:p-6">{empty}</p>;
  return (
    <ScrollX>
      <table className="w-full min-w-[36rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-primary-100 bg-primary-50">
            {columns.map((c) => (
              <th key={c} scope="col" className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-primary-900">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-primary-50 align-top last:border-0">
              {r.cells.map((cell, i) => (
                <td key={i} className="min-w-[7rem] px-4 py-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollX>
  );
}
