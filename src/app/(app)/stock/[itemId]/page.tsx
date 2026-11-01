import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { formatDate, formatNumber, localName } from "@/lib/format";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { round } from "@/lib/stock";
import { Card, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";

export default async function ItemLedgerPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const session = await requireUser();
  const db = tenantDb(session.clientId);
  const item = await db.item.findFirst({ where: { id: itemId } });
  if (!item) notFound();
  const t = await getTranslations();
  const { locale, numerals } = await getFormatPrefs();
  const moves = await db.stockMovement.findMany({
    where: { itemId, ...(session.institutionId ? { institutionId: session.institutionId } : {}), status: { in: ["APPROVED", "PENDING"] } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  let running = 0;
  const rows = moves.map((m) => {
    if (m.status === "APPROVED") running = round(running + (m.direction === "IN" ? m.qty : -m.qty));
    return { m, balance: running };
  });
  const n = (v: number) => formatNumber(v, { numerals });

  return (
    <div className="space-y-6">
      <Link href="/stock" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <ArrowLeft size={16} aria-hidden />
        {t("stock.title")}
      </Link>
      <PageHeader title={t("stock.ledgerTitle", { item: localName(item, locale) })} intro={t("entries.pendingNote")} />
      <Card className="p-0 sm:p-0">
        <DataTable
          empty={t("stock.noMovements")}
          columns={[t("entries.date"), t("stock.register"), t("stock.type"), t("stock.in"), t("stock.out"), t("stock.runningBalance"), t("entries.status")]}
          rows={rows.reverse().map(({ m, balance }) => ({
            key: m.id,
            cells: [
              formatDate(m.date, { numerals }),
              <Link key="r" href={`/registers/${m.module}/${m.entryId}`} className="text-primary-800 hover:underline">
                {t(`modules.${m.module}`)}
              </Link>,
              t(`kinds.${m.type}`),
              m.direction === "IN" ? n(m.qty) : "",
              m.direction === "OUT" ? n(m.qty) : "",
              m.status === "APPROVED" ? `${n(balance)} ${t(`units.${item.unit}`)}` : "—",
              <StatusBadge key="s" status={m.status} />,
            ],
          }))}
        />
      </Card>
    </div>
  );
}
