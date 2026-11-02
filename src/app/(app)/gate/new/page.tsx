import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { CATEGORIES } from "@/lib/modules";
import { todayIST } from "@/lib/entry-form";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { loadItemOptions } from "@/lib/ui-data";
import { PageHeader } from "@/components/ui/card";
import { VisitForm } from "../visit-form";

export default async function NewVisitPage() {
  const session = await requireUser();
  if (session.role !== "STORE_USER") redirect("/gate");
  const t = await getTranslations();
  const { locale } = await getFormatPrefs();
  const items = await loadItemOptions(tenantDb(session.clientId), CATEGORIES, locale);
  return (
    <div className="space-y-6">
      <PageHeader title={t("gate.newVisit")} intro={t("entries.pendingNote")} />
      <VisitForm items={items} today={todayIST()} />
    </div>
  );
}
