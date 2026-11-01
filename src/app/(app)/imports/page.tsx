import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FileSpreadsheet } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { formatDateTime, formatNumber } from "@/lib/format";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { Card, CardTitle, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { UploadForm } from "./upload-form";

export async function generateMetadata() {
  return { title: (await getTranslations("imports"))("title") };
}

export default async function ImportsPage() {
  const session = await requireAdmin();
  const t = await getTranslations();
  const { numerals } = await getFormatPrefs();
  const batches = await tenantDb(session.clientId).importBatch.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, fileName: true, status: true, stats: true, createdAt: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("imports.title")} intro={t("imports.intro")}>
        <a href="/imports/template" download className={buttonVariants({ variant: "outline" })}>
          <FileSpreadsheet size={18} aria-hidden />
          {t("imports.template")}
        </a>
      </PageHeader>
      <Card>
        <UploadForm />
      </Card>
      <Card className="p-0 sm:p-0">
        <CardTitle className="px-4 pt-4 sm:px-6">{t("nav.imports")}</CardTitle>
        <DataTable
          empty={t("common.noRecords")}
          columns={[t("common.createdAt"), t("imports.file_"), t("entries.status"), t("imports.stats.visitRows"), t("imports.stats.flaggedRows")]}
          rows={batches.map((b) => {
            const s = (b.stats ?? {}) as Record<string, number>;
            return {
              key: b.id,
              cells: [
                formatDateTime(b.createdAt, { numerals }),
                <Link key="f" href={`/imports/${b.id}`} className="font-medium text-primary-800 hover:underline">
                  {b.fileName}
                </Link>,
                t(`imports.statuses.${b.status}`),
                formatNumber(s.visitRows ?? 0, { numerals }),
                formatNumber(s.flaggedRows ?? 0, { numerals }),
              ],
            };
          })}
        />
      </Card>
    </div>
  );
}
