import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CalendarRange, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { formatNumber } from "@/lib/format";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { stockRows } from "@/lib/stock-view";
import { CATEGORIES } from "@/lib/modules";
import { Card, Notice, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { StockBadge } from "@/components/stock-badge";

export async function generateMetadata() {
  return { title: (await getTranslations("stock"))("title") };
}

export default async function StockPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const session = await requireUser();
  const t = await getTranslations();
  const { locale, numerals } = await getFormatPrefs();
  const requested = (await searchParams).category;
  const category = CATEGORIES.find((c) => c === requested);
  if (!session.institutionId) return <Notice tone="alert">{t("home.noInstitution")}</Notice>;
  const all = await stockRows(tenantDb(session.clientId), session.institutionId, locale);
  const rows = category ? all.filter((r) => r.category === category) : all;
  const cats = [...new Set(all.map((r) => r.category))];
  const n = (v: number) => formatNumber(v, { numerals });

  return (
    <div className="space-y-6">
      <PageHeader title={t("stock.title")} intro={t("stock.intro")}>
        <div className="flex flex-wrap gap-2">
          <Link href="/registers/purchase/new" className={buttonVariants()}>
            <Plus size={18} aria-hidden />
            {t("stock.addPurchase")}
          </Link>
          <Link href="/stock/statement" className={buttonVariants({ variant: "outline" })}>
            <CalendarRange size={18} aria-hidden />
            {t("stock.statement")}
          </Link>
        </div>
      </PageHeader>
      <nav className="flex flex-wrap gap-1" aria-label={t("stock.category")}>
        {[undefined, ...cats].map((c) => (
          <Link
            key={c ?? "all"}
            href={c ? `/stock?category=${c}` : "/stock"}
            aria-current={c === category ? "page" : undefined}
            className={buttonVariants({ variant: c === category ? "primary" : "outline", size: "sm" })}
          >
            {c ? t(`categories.${c}`) : t("stock.allCategories")}
          </Link>
        ))}
      </nav>
      <Card className="p-0 sm:p-0">
        <DataTable
          empty={t("common.noRecords")}
          columns={[t("entries.item"), t("stock.balance"), t("stock.pendingIn"), t("stock.pendingOut"), t("stock.reorderLevel"), t("stock.daysLeft"), t("stock.status")]}
          rows={rows.map((r) => {
            const unit = t(`units.${r.unit}`);
            return {
              key: r.id,
              cells: [
                <Link key="n" href={`/stock/${r.id}`} className="font-medium text-primary-800 hover:underline">
                  {r.name}
                </Link>,
                <span key="b" className="font-semibold">{`${n(r.balance)} ${unit}`}</span>,
                r.pendingIn ? `+${n(r.pendingIn)}` : "—",
                r.pendingOut ? `−${n(r.pendingOut)}` : "—",
                r.reorderLevel != null ? `${n(r.reorderLevel)} ${unit}` : "—",
                r.daysLeft != null ? n(r.daysLeft) : "—",
                <StockBadge key="s" status={r.status} />,
              ],
            };
          })}
        />
      </Card>
    </div>
  );
}
