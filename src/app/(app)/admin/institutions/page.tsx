import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { formatDate, localName } from "@/lib/format";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { Card, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { NewInstitutionForm } from "./new-institution-form";

export async function generateMetadata() {
  return { title: (await getTranslations("institutions"))("title") };
}

export default async function InstitutionsPage() {
  const session = await requireAdmin();
  const t = await getTranslations();
  const { locale, numerals } = await getFormatPrefs();
  const institutions = await tenantDb(session.clientId).institution.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="space-y-6">
      <PageHeader title={t("institutions.title")} />
      <Card className="p-0 sm:p-0">
        <DataTable
          empty={t("common.noRecords")}
          columns={[t("institutions.code"), t("institutions.nameMr"), t("institutions.cityMr"), t("common.createdAt")]}
          rows={institutions.map((i) => ({
            key: i.id,
            cells: [
              <span key="c" className="font-mono text-sm">{i.code}</span>,
              <span key="n">
                <span className="block font-medium">{localName(i, locale)}</span>
                <span className="block text-sm text-ink-muted">{localName(i, locale === "mr" ? "en" : "mr")}</span>
              </span>,
              localName({ nameMr: i.cityMr, nameEn: i.cityEn }, locale),
              formatDate(i.createdAt, { numerals }),
            ],
          }))}
        />
      </Card>
      <NewInstitutionForm />
    </div>
  );
}
