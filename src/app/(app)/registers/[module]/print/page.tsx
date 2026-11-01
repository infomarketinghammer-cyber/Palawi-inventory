import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isModuleKey } from "@/lib/modules";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { formatDate, localName } from "@/lib/format";
import { validMonth } from "@/lib/ui-data";
import { registerReport } from "@/lib/register-report";
import { PrintSheet } from "@/components/print-sheet";
import { monthLabel } from "@/components/month-nav";

export default async function PrintRegisterPage({ params, searchParams }: { params: Promise<{ module: string }>; searchParams: Promise<{ month?: string }> }) {
  const { module } = await params;
  if (!isModuleKey(module)) notFound();
  const session = await requireUser();
  const month = validMonth((await searchParams).month);
  const t = await getTranslations();
  const { locale, numerals } = await getFormatPrefs();
  const report = await registerReport(session, module, month, locale, numerals);
  const inst = session.institutionId ? await prisma.institution.findFirst({ where: { id: session.institutionId, clientId: session.clientId } }) : null;

  return (
    <PrintSheet
      institution={inst ? localName(inst, locale) : ""}
      title={report.title}
      subtitle={t("print.monthYear", { month: monthLabel(month, numerals) })}
      printedOn={t("print.printedOn", { date: formatDate(new Date(), { numerals }) })}
      columns={report.columns}
      rows={report.rows}
      empty={t("entries.noEntries")}
      printLabel={t("entries.print")}
      backHref={`/registers/${module}?month=${month}`}
      backLabel={t("entries.back")}
    />
  );
}
