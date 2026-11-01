import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { isModuleKey, MODULES } from "@/lib/modules";
import { todayIST } from "@/lib/entry-form";
import { canEdit, dateToDay } from "@/lib/entries";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { PageHeader } from "@/components/ui/card";
import { EntryForm, type EntryInitial } from "@/components/entry-form";
import { saveEntry } from "../../../actions";
import { loadFormData } from "../../form-data";

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default async function EditEntryPage({ params }: { params: Promise<{ module: string; id: string }> }) {
  const { module, id } = await params;
  if (!isModuleKey(module)) notFound();
  const session = await requireUser();
  const db = tenantDb(session.clientId);
  const entry = await db.entry.findFirst({ where: { id, module } });
  if (!entry) notFound();
  if (!canEdit(session, entry)) redirect(`/registers/${module}/${id}`);
  const t = await getTranslations();
  const { locale } = await getFormatPrefs();
  const data = await loadFormData(db, module, entry.institutionId, locale, entry.id);
  const cfg = MODULES[module];

  const fields = Object.fromEntries(Object.entries((entry.fields ?? {}) as Record<string, unknown>).map(([k, v]) => [k, str(v)]));
  const initial: EntryInitial = {
    date: dateToDay(entry.date),
    childCount: str(entry.childCount),
    fields,
    remarks: str(entry.remarks),
    lines: entry.lines.map((l) => ({
      itemId: str(l.itemId),
      inQty: str(l.inQty),
      outQty: str(l.outQty),
      qty: str(cfg.lineMode === "kind" ? l.inQty ?? l.outQty : l.outQty ?? l.inQty),
      kind: str(l.kind),
      source: str(l.source) || "purchased",
      donorName: str(l.donorName),
      rate: str(l.rate),
      expiryDate: l.expiryDate ? dateToDay(l.expiryDate) : "",
      acknowledged: l.acknowledged ?? true,
      note: str(l.note),
    })),
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("entries.editTitle", { register: t(`modules.${module}`) })} intro={t("entries.pendingNote")} />
      <EntryForm
        module={module}
        action={saveEntry.bind(null, module, entry.id)}
        items={data.items}
        available={data.available}
        suggestions={data.suggestions}
        initial={initial}
        today={todayIST()}
        isAdmin={session.role === "ADMIN"}
        submitLabel={t("common.save")}
      />
    </div>
  );
}
