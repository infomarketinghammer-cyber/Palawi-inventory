import "server-only";
import path from "node:path";
import fs from "node:fs";
import PDFDocument from "pdfkit";

// Noto Sans for Latin, Noto Sans Devanagari for Marathi. pdfkit cannot fall back per glyph, so mixed
// text is split into script runs and each run is drawn with the matching font.
const FONT_DIR = path.join(process.cwd(), "node_modules", "@fontsource");
const FONTS = {
  latin: path.join(FONT_DIR, "noto-sans", "files", "noto-sans-latin-400-normal.woff"),
  latinBold: path.join(FONT_DIR, "noto-sans", "files", "noto-sans-latin-700-normal.woff"),
  deva: path.join(FONT_DIR, "noto-sans-devanagari", "files", "noto-sans-devanagari-devanagari-400-normal.woff"),
  devaBold: path.join(FONT_DIR, "noto-sans-devanagari", "files", "noto-sans-devanagari-devanagari-700-normal.woff"),
};
const LOGO = path.join(process.cwd(), "public", "palawi-logo.png");
const TEAL = "#31634f";
const INK = "#1b372c";

/** Splits text into runs of Devanagari vs everything else (spaces stay with the run before them). */
export function scriptRuns(text: string): { deva: boolean; text: string }[] {
  const runs: { deva: boolean; text: string }[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    const isDeva = (code >= 0x0900 && code <= 0x097f) || code === 0x200c || code === 0x200d || code === 0x20b9;
    const neutral = ch === " ";
    const last = runs[runs.length - 1];
    if (last && (last.deva === isDeva || neutral)) last.text += ch;
    else runs.push({ deva: isDeva, text: ch });
  }
  return runs;
}

export type ReceiptData = {
  orgName: string;
  orgTagline: string;
  institution: string;
  title: string;
  receiptNo: string;
  rows: [string, string][];
  thanks: string;
  footer: string;
};

export async function receiptPdf(d: ReceiptData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A5", margin: 36, info: { Title: `${d.title} ${d.receiptNo}`, Author: d.orgName } });
  doc.registerFont("latin", FONTS.latin);
  doc.registerFont("latinBold", FONTS.latinBold);
  doc.registerFont("deva", FONTS.deva);
  doc.registerFont("devaBold", FONTS.devaBold);
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const write = (text: string, opts: { size?: number; bold?: boolean; color?: string; align?: "left" | "center" | "right"; x?: number; y?: number; width?: number } = {}) => {
    const runs = scriptRuns(text || " ");
    doc.fillColor(opts.color ?? INK).fontSize(opts.size ?? 11);
    runs.forEach((r, i) => {
      doc.font(r.deva ? (opts.bold ? "devaBold" : "deva") : opts.bold ? "latinBold" : "latin");
      const last = i === runs.length - 1;
      const o = { continued: !last, align: opts.align, width: opts.width };
      if (i === 0 && opts.x !== undefined) doc.text(r.text, opts.x, opts.y, o);
      else doc.text(r.text, o);
    });
  };

  // Left alignment only: pdfkit mis-positions centred/right-aligned text that switches fonts mid-line.
  const w = doc.page.width - 72;
  if (fs.existsSync(LOGO)) doc.image(LOGO, 36, 30, { width: 110 });
  write(d.orgName, { size: 14, bold: true, color: TEAL, x: 160, y: 30, width: w - 124 });
  write(d.orgTagline, { size: 9, color: TEAL, x: 160, width: w - 124 });
  write(d.institution, { size: 10, x: 160, width: w - 124 });
  const lineY = Math.max(doc.y, 76) + 6;
  doc.moveTo(36, lineY).lineTo(36 + w, lineY).strokeColor(TEAL).lineWidth(1.5).stroke();

  write(d.title, { size: 16, bold: true, color: TEAL, x: 36, y: lineY + 12, width: w });
  write(d.receiptNo, { size: 10, x: 36, width: w });
  doc.moveDown(1);

  for (const [label, value] of d.rows) {
    const y = doc.y;
    write(label, { size: 10, bold: true, x: 36, y, width: 130 });
    const yAfterLabel = doc.y;
    write(value || "—", { size: 10, x: 170, y, width: w - 134 });
    doc.y = Math.max(doc.y, yAfterLabel) + 4;
  }
  doc.moveDown(1);
  write(d.thanks, { size: 11, color: TEAL, x: 36, width: w });
  doc.moveDown(2);
  write(d.footer, { size: 8, color: "#496e60", x: 36, width: w });
  doc.end();
  return done;
}
