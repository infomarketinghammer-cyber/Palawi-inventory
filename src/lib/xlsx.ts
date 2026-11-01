import "server-only";
import ExcelJS from "exceljs";

/** Builds a simple single-sheet workbook (title rows + header + data) and returns an xlsx download response. */
export async function xlsxResponse(fileName: string, titleLines: string[], columns: string[], rows: (string | number)[][]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Palawi";
  const ws = wb.addWorksheet("Sheet1");
  for (const line of titleLines) {
    const r = ws.addRow([line]);
    r.font = { bold: true, size: 13 };
  }
  if (titleLines.length) ws.addRow([]);
  const head = ws.addRow(columns);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3C7B62" } }));
  for (const r of rows) ws.addRow(r);
  ws.columns.forEach((col, i) => {
    const max = Math.max(columns[i]?.length ?? 8, ...rows.map((r) => String(r[i] ?? "").length));
    col.width = Math.min(60, Math.max(10, max + 2));
  });
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}
