import { getTranslations } from "next-intl/server";
import { requireClientManager } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, formatNumber, localName } from "@/lib/format";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { Card, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { NewClientForm } from "./new-client-form";

export async function generateMetadata() {
  return { title: (await getTranslations("clients"))("title") };
}

export default async function ClientsPage() {
  await requireClientManager();
  const t = await getTranslations();
  const { locale, numerals } = await getFormatPrefs();

  // Platform view: only client-level facts and counts, never any client's operational data.
  const clients = await prisma.client.findMany({
    where: { deletedAt: { isSet: false } },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { institutions: { where: { deletedAt: { isSet: false } } }, users: { where: { deletedAt: { isSet: false } } } } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("clients.title")} intro={t("clients.intro")} />
      <Card className="p-0 sm:p-0">
        <DataTable
          empty={t("common.noRecords")}
          columns={[t("clients.code"), t("clients.nameMr"), t("clients.institutions"), t("clients.users"), t("common.createdAt")]}
          rows={clients.map((c) => ({
            key: c.id,
            cells: [
              <span key="code" className="font-mono text-sm">{c.code}</span>,
              <span key="name">
                <span className="block font-medium">{localName(c, locale)}</span>
                <span className="block text-sm text-ink-muted">{localName(c, locale === "mr" ? "en" : "mr")}</span>
              </span>,
              formatNumber(c._count.institutions, { numerals }),
              formatNumber(c._count.users, { numerals }),
              formatDate(c.createdAt, { numerals }),
            ],
          }))}
        />
      </Card>
      <NewClientForm />
    </div>
  );
}
