import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CheckCircle2, CircleSlash } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { formatNumber, localName } from "@/lib/format";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { Badge, Card, CardTitle, Notice, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { ActionForm } from "@/components/action-form";
import { ItemForm } from "./item-form";
import { saveItem, toggleItemAction } from "./actions";

export async function generateMetadata() {
  return { title: (await getTranslations("items"))("title") };
}

export default async function ItemsPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const session = await requireAdmin();
  const t = await getTranslations();
  const { locale, numerals } = await getFormatPrefs();
  const items = await tenantDb(session.clientId).item.findMany({ orderBy: [{ category: "asc" }, { code: "asc" }] });
  const { done } = await searchParams;

  return (
    <div className="space-y-6">
      <PageHeader title={t("items.title")} />
      {done === "saved" && <Notice>{t("items.saved")}</Notice>}
      <Card className="p-0 sm:p-0">
        <DataTable
          empty={t("common.noRecords")}
          columns={[t("items.code"), t("items.nameMr"), t("items.category"), t("items.unit"), t("items.reorderLevel"), t("entries.status"), t("common.actions")]}
          rows={items.map((i) => ({
            key: i.id,
            cells: [
              <Link key="c" href={`/items/${i.id}`} className="font-mono text-sm text-primary-800 hover:underline">
                {i.code}
              </Link>,
              <span key="n">
                <span className="block font-medium">{localName(i, locale)}</span>
                <span className="block text-sm text-ink-muted">{localName(i, locale === "mr" ? "en" : "mr")}</span>
              </span>,
              `${t(`categories.${i.category}`)}${i.group ? ` · ${t(`vegGroups.${i.group}`)}` : ""}`,
              t(`units.${i.unit}`),
              i.reorderLevel != null ? formatNumber(i.reorderLevel, { numerals }) : "—",
              i.active ? (
                <Badge key="s" tone="ok" icon={<CheckCircle2 size={14} aria-hidden />}>
                  {t("common.active")}
                </Badge>
              ) : (
                <Badge key="s" tone="neutral" icon={<CircleSlash size={14} aria-hidden />}>
                  {t("common.inactive")}
                </Badge>
              ),
              <ActionForm key="a" action={toggleItemAction} hidden={{ id: i.id }} label={i.active ? t("items.deactivate") : t("items.activate")} variant="outline" />,
            ],
          }))}
        />
      </Card>
      <Card>
        <CardTitle className="mb-4">{t("items.add")}</CardTitle>
        <ItemForm action={saveItem.bind(null, null)} />
      </Card>
    </div>
  );
}
