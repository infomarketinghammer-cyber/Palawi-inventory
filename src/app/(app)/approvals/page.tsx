import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { formatDate } from "@/lib/format";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { itemNames } from "@/lib/ui-data";
import { summarise } from "@/lib/entry-view";
import { dateToDay } from "@/lib/entries";
import { Card, Notice, PageHeader } from "@/components/ui/card";
import { ActionForm } from "@/components/action-form";
import { approveDayAction, approveEntryAction } from "../registers/actions";
import { approveVisitAction } from "../gate/actions";

export async function generateMetadata() {
  return { title: (await getTranslations("approvals"))("title") };
}

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ done?: string; approvedCount?: string; skipped?: string }> }) {
  const session = await requireAdmin();
  const sp = await searchParams;
  const t = await getTranslations();
  const { locale, numerals } = await getFormatPrefs();
  const db = tenantDb(session.clientId);
  const inst = session.institutionId ? { institutionId: session.institutionId } : {};
  const [entries, visits, names] = await Promise.all([
    db.entry.findMany({ where: { status: "PENDING", ...inst }, orderBy: [{ date: "desc" }, { createdAt: "asc" }], take: 300 }),
    db.visit.findMany({ where: { status: "PENDING", ...inst }, orderBy: [{ date: "desc" }, { createdAt: "asc" }], take: 300 }),
    itemNames(db, locale),
  ]);

  const summaries = new Map(await Promise.all(entries.map(async (e) => [e.id, await summarise(e, names, numerals)] as const)));
  const days = new Map<string, { entries: typeof entries; visits: typeof visits }>();
  for (const e of entries) {
    const d = days.get(dateToDay(e.date)) ?? { entries: [], visits: [] };
    d.entries.push(e);
    days.set(dateToDay(e.date), d);
  }
  for (const v of visits) {
    const d = days.get(dateToDay(v.date)) ?? { entries: [], visits: [] };
    d.visits.push(v);
    days.set(dateToDay(v.date), d);
  }
  const sorted = [...days].sort((a, b) => (a[0] < b[0] ? 1 : -1));

  return (
    <div className="space-y-6">
      <PageHeader title={t("approvals.title")} intro={t("approvals.intro")} />
      {sp.done === "approved" && <Notice>{t("entries.approved")}</Notice>}
      {sp.done === "day" && <Notice>{t("approvals.dayDone", { approved: Number(sp.approvedCount ?? 0), skipped: Number(sp.skipped ?? 0) })}</Notice>}
      {sorted.length === 0 && (
        <Card>
          <p className="text-ink-muted">{t("approvals.none")}</p>
        </Card>
      )}
      {sorted.map(([day, { entries: es, visits: vs }]) => (
        <Card key={day} className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-primary-800">{formatDate(new Date(`${day}T00:00:00Z`), { numerals })}</h2>
              <p className="text-sm text-ink-muted">{t("approvals.count", { count: es.length + vs.length })}</p>
            </div>
            <ActionForm action={approveDayAction} hidden={{ day, back: "/approvals" }} label={t("entries.approveDay")} />
          </div>
          <ul className="space-y-2">
            {es.map((e) => (
                <li key={e.id} className="flex flex-col gap-2 rounded-xl border border-primary-100 bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
                  <Link href={`/registers/${e.module}/${e.id}`} className="min-w-0 hover:underline">
                    <span className="block font-medium text-primary-800">{t(`modules.${e.module}`)}</span>
                    <span className="block text-sm text-ink">{summaries.get(e.id)}</span>
                    <span className="block text-sm text-ink-muted">
                      {t("entries.createdBy")}: {e.createdByName}
                    </span>
                  </Link>
                  <ActionForm
                    action={approveEntryAction}
                    hidden={{ id: e.id, module: e.module, back: "/approvals" }}
                    label={t("entries.approve")}
                    variant="secondary"
                    reasonOnError={{ name: "overrideReason", label: t("entries.overrideReason"), whenMessage: "entries.insufficientApproved" }}
                  />
                </li>
              ))}
            {vs.map((v) => (
              <li key={v.id} className="flex flex-col gap-2 rounded-xl border border-primary-100 bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
                <Link href={`/gate/${v.id}`} className="min-w-0 hover:underline">
                  <span className="block font-medium text-primary-800">{t("approvals.visits")}</span>
                  <span className="block text-sm text-ink">
                    {v.visitorName} — {v.purpose ? t(`gate.purposes.${v.purpose}`) : "—"}
                  </span>
                </Link>
                <ActionForm action={approveVisitAction} hidden={{ id: v.id, back: "/approvals" }} label={t("entries.approve")} variant="secondary" />
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
