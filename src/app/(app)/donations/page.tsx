import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FileDown } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { formatDate, formatINR } from "@/lib/format";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { monthRange, validMonth } from "@/lib/ui-data";
import { Card, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { MonthNav, monthLabel } from "@/components/month-nav";

export async function generateMetadata() {
  return { title: (await getTranslations("donations"))("title") };
}

export default async function DonationsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await requireUser();
  const month = validMonth((await searchParams).month);
  const t = await getTranslations();
  const { numerals } = await getFormatPrefs();
  const { start, end } = monthRange(month);
  const donations = await tenantDb(session.clientId).donation.findMany({
    where: { date: { gte: start, lt: end }, ...(session.institutionId ? { institutionId: session.institutionId } : {}) },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("donations.title")} />
      <MonthNav base="/donations" month={month} label={monthLabel(month, numerals)} />
      <Card className="p-0 sm:p-0">
        <DataTable
          empty={t("common.noRecords")}
          columns={[t("entries.date"), t("donations.donor"), t("donations.type"), t("donations.description"), t("donations.amount"), t("donations.receiptNo"), t("entries.status")]}
          rows={donations.map((d) => ({
            key: d.id,
            cells: [
              formatDate(d.date, { numerals }),
              d.visitId ? (
                <Link key="n" href={`/gate/${d.visitId}`} className="font-medium text-primary-800 hover:underline">
                  {d.donorName}
                </Link>
              ) : (
                d.donorName
              ),
              t(`donations.types.${d.type}`),
              <span key="desc" className="block max-w-xs text-sm">
                {d.description}
                {d.importBatchId && <span className="block text-ink-muted">{t("donations.imported")}</span>}
              </span>,
              d.amount != null ? formatINR(d.amount, { numerals }) : "—",
              d.status === "APPROVED" && d.receiptNo ? (
                <a key="r" href={`/donations/${d.id}/receipt`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <FileDown size={14} aria-hidden />
                  {d.receiptNo}
                </a>
              ) : (
                <span key="r" className="text-sm text-ink-muted">{t("donations.notApproved")}</span>
              ),
              <StatusBadge key="s" status={d.status} />,
            ],
          }))}
        />
      </Card>
    </div>
  );
}
