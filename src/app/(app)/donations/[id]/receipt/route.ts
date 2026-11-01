import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tenantDb } from "@/lib/tenant";
import { formatDate, formatINR } from "@/lib/format";
import { receiptPdf } from "@/lib/receipt-pdf";

export const runtime = "nodejs";

/** Bilingual (मराठी + English) donation receipt, PDF only, for approved donations. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const d = await tenantDb(session.clientId).donation.findFirst({ where: { id } });
  if (!d) return new Response("Not found", { status: 404 });
  if (d.status !== "APPROVED" || !d.receiptNo) return new Response("Receipt is issued after approval", { status: 409 });

  const [client, inst] = await Promise.all([
    prisma.client.findUniqueOrThrow({ where: { id: session.clientId } }),
    prisma.institution.findFirst({ where: { id: d.institutionId, clientId: session.clientId } }),
  ]);
  const [mr, en] = await Promise.all([getTranslations({ locale: "mr" }), getTranslations({ locale: "en" })]);
  const both = (k: string) => `${mr(k)} / ${en(k)}`;

  const pdf = await receiptPdf({
    orgName: `${client.nameMr} / ${client.nameEn}`,
    orgTagline: [client.taglineMr, client.taglineEn].filter(Boolean).join(" · "),
    institution: inst ? `${inst.nameMr} — ${inst.nameEn}` : "",
    title: both("receipt.title"),
    receiptNo: d.receiptNo,
    rows: [
      [both("entries.date"), formatDate(d.date)],
      [both("donations.donor"), [d.donorName, d.donorAddress].filter(Boolean).join(", ")],
      [both("donations.type"), `${mr(`donations.types.${d.type}`)} / ${en(`donations.types.${d.type}`)}`],
      ...(d.description ? ([[both("donations.description"), d.description]] as [string, string][]) : []),
      ...(d.amount != null ? ([[both("donations.amount"), formatINR(d.amount)]] as [string, string][]) : []),
    ],
    thanks: `${mr("receipt.thanks")} ${en("receipt.thanks")}`,
    footer: `${d.receiptNo} · ${formatDate(new Date())}`,
  });
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${d.receiptNo.replace(/\//g, "-")}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
