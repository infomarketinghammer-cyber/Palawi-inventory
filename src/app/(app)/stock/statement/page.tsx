import { getTranslations } from "next-intl/server";
import { FileSpreadsheet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { formatNumber } from "@/lib/format";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { validMonth } from "@/lib/ui-data";
import { monthlyStatement } from "@/lib/statement";
import { Card, Notice, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { MonthNav, monthLabel } from "@/components/month-nav";

export default async function StatementPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await requireUser();
  const month = validMonth((await searchParams).month);
  const t = await getTranslations();
  const { locale, numerals } = await getFormatPrefs();
  if (!session.institutionId) return <Notice tone="alert">{t("home.noInstitution")}</Notice>;
  const rows = await monthlyStatement(tenantDb(session.clientId), session.institutionId, month, locale);
  const n = (v: number) => formatNumber(v, { numerals });

  return (
    <div className="space-y-6">
      <PageHeader title={t("stock.statement")} intro={t("stock.intro")}>
        <a href={`/stock/statement/export?month=${month}`} className={buttonVariants({ variant: "outline" })}>
          <FileSpreadsheet size={18} aria-hidden />
          {t("entries.export")}
        </a>
      </PageHeader>
      <MonthNav base="/stock/statement" month={month} label={monthLabel(month, numerals)} />
      <Card className="p-0 sm:p-0">
        <DataTable
          empty={t("stock.noMovements")}
          columns={[t("entries.item"), t("stock.category"), t("stock.opening"), t("stock.received"), t("stock.consumed"), t("stock.closing")]}
          rows={rows.map((r) => ({
            key: r.id,
            cells: [`${r.name} (${t(`units.${r.unit}`)})`, t(`categories.${r.category}`), n(r.opening), n(r.received), n(r.consumed), <strong key="c">{n(r.closing)}</strong>],
          }))}
        />
      </Card>
    </div>
  );
}
