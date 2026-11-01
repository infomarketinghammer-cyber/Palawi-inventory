import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { formatNumber } from "@/lib/format";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import type { ImportIssue } from "@/lib/gate";
import { Card, CardTitle, Notice, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { ActionForm } from "@/components/action-form";
import { commitImportAction, rollbackImportAction } from "../actions";

const SHOW = 300;

export default async function ImportBatchPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  const { id } = await params;
  const { done } = await searchParams;
  const session = await requireAdmin();
  const batch = await tenantDb(session.clientId).importBatch.findFirst({
    where: { id },
    select: { id: true, fileName: true, status: true, stats: true, issues: true },
  });
  if (!batch) notFound();
  const t = await getTranslations();
  const { numerals } = await getFormatPrefs();
  const stats = (batch.stats ?? {}) as Record<string, number>;
  const issues = (batch.issues ?? []) as ImportIssue[];
  const counts = new Map<string, number>();
  for (const i of issues) counts.set(i.code, (counts.get(i.code) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <Link href="/imports" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <ArrowLeft size={16} aria-hidden />
        {t("imports.title")}
      </Link>
      <PageHeader title={batch.fileName} intro={t(`imports.statuses.${batch.status}`)} />
      {done === "committed" && <Notice>{t("imports.committed")}</Notice>}
      {done === "rolledBack" && <Notice>{t("imports.rolledBack")}</Notice>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(stats).map(([k, v]) => (
          <Card key={k} className="p-4 sm:p-4">
            <p className="text-sm text-ink-muted">{t.has(`imports.stats.${k}`) ? t(`imports.stats.${k}`) : k}</p>
            <p className="text-2xl font-semibold text-primary-800">{formatNumber(v, { numerals })}</p>
          </Card>
        ))}
      </div>

      <Card className="space-y-3">
        {batch.status === "DRY_RUN" && <ActionForm action={commitImportAction} hidden={{ id: batch.id, back: `/imports/${batch.id}` }} label={t("imports.commit")} />}
        {batch.status === "COMMITTED" && (
          <div className="flex flex-wrap gap-3">
            <Link href="/gate" className={buttonVariants({ variant: "outline" })}>
              {t("gate.title")}
            </Link>
            <ActionForm action={rollbackImportAction} hidden={{ id: batch.id, back: `/imports/${batch.id}` }} label={t("imports.rollback")} variant="danger" />
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <CardTitle>{t("imports.issues")}</CardTitle>
        <ul className="flex flex-wrap gap-2">
          {[...counts].map(([code, c]) => (
            <li key={code} className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-sm">
              {t(`gate.flags.${code}`)}: {formatNumber(c, { numerals })}
            </li>
          ))}
        </ul>
        {issues.length > SHOW && <p className="text-sm text-ink-muted">{t("imports.showingFirst", { count: SHOW })}</p>}
      </Card>
      <Card className="p-0 sm:p-0">
        <DataTable
          empty={t("common.noRecords")}
          columns={[t("imports.row"), t("imports.code"), t("imports.detail")]}
          rows={issues.slice(0, SHOW).map((i, idx) => ({ key: `${i.row}-${idx}`, cells: [formatNumber(i.row, { numerals }), t(`gate.flags.${i.code}`), i.detail] }))}
        />
      </Card>
    </div>
  );
}
