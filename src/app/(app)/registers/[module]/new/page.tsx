import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { isModuleKey, MODULES } from "@/lib/modules";
import { todayIST } from "@/lib/entry-form";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { PageHeader } from "@/components/ui/card";
import { EntryForm } from "@/components/entry-form";
import { saveEntry } from "../../actions";
import { loadFormData } from "../form-data";

export default async function NewEntryPage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  if (!isModuleKey(module)) notFound();
  const session = await requireUser();
  if (!MODULES[module].createRoles.includes(session.role)) redirect(`/registers/${module}?denied=1`);
  const t = await getTranslations();
  const { locale } = await getFormatPrefs();
  const data = await loadFormData(tenantDb(session.clientId), module, session.institutionId, locale);

  return (
    <div className="space-y-6">
      <PageHeader title={t("entries.newTitle", { register: t(`modules.${module}`) })} intro={t("entries.pendingNote")} />
      <EntryForm
        module={module}
        action={saveEntry.bind(null, module, null)}
        items={data.items}
        available={data.available}
        suggestions={data.suggestions}
        today={todayIST()}
        isAdmin={session.role === "ADMIN"}
        submitLabel={t("common.save")}
      />
    </div>
  );
}
