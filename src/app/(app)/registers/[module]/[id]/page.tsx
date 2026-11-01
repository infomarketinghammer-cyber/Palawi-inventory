import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Pencil } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { isModuleKey, MODULES } from "@/lib/modules";
import { canEdit, openingForEntry } from "@/lib/entries";
import { formatDate, formatDateTime, formatINR, formatNumber } from "@/lib/format";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { itemNames } from "@/lib/ui-data";
import { round } from "@/lib/stock";
import { Card, CardTitle, Notice, PageHeader } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { ActionForm } from "@/components/action-form";
import { adminFieldsAction, approveEntryAction, deleteEntryAction, rejectEntryAction, unlockEntryAction } from "../../actions";
import { AdminFieldsForm } from "./admin-fields-form";

export default async function EntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ module: string; id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { module, id } = await params;
  if (!isModuleKey(module)) notFound();
  const session = await requireUser();
  const db = tenantDb(session.clientId);
  const entry = await db.entry.findFirst({ where: { id, module } });
  if (!entry) notFound();
  const { done } = await searchParams;
  const cfg = MODULES[module];
  const t = await getTranslations();
  const { locale, numerals } = await getFormatPrefs();
  const names = await itemNames(db, locale);
  const n = (v: number | null | undefined) => (v == null ? "—" : formatNumber(v, { numerals }));
  const fields = (entry.fields ?? {}) as Record<string, string | number | null>;
  const isAdmin = session.role === "ADMIN";
  const editable = canEdit(session, entry);
  const hidden = { id: entry.id, module, back: `/registers/${module}/${entry.id}` };

  // Opening = approved stock just before this entry; balance = opening + received − consumed in this entry.
  const showsBalance = cfg.lineMode === "inout" || cfg.lineMode === "out";
  const opening = showsBalance ? await openingForEntry(db, entry, entry.lines.map((l) => l.itemId!).filter(Boolean)) : null;

  const lineColumns = [
    t("entries.item"),
    ...(cfg.lineMode === "kind" ? [t("entries.kind")] : []),
    ...(showsBalance ? [t("entries.opening")] : []),
    ...(cfg.lineMode === "inout" ? [t("entries.inQty"), t("entries.outQty")] : [t("entries.qty")]),
    ...(showsBalance ? [t("entries.balance")] : []),
    ...(cfg.lineExtras.includes("source") ? [t("entries.source")] : []),
    ...(cfg.lineExtras.includes("rate") ? [t("entries.amount")] : []),
    ...(cfg.lineExtras.includes("acknowledged") ? [t("entries.acknowledged")] : []),
    ...(cfg.lineExtras.includes("note") || cfg.lineExtras.includes("donorName") ? [t("entries.note")] : []),
  ];

  return (
    <div className="space-y-6">
      <Link href={`/registers/${module}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <ArrowLeft size={16} aria-hidden />
        {t(`modules.${module}`)}
      </Link>
      <PageHeader title={`${t(`modules.${module}`)} — ${formatDate(entry.date, { numerals })}`}>
        <StatusBadge status={entry.status} />
      </PageHeader>

      {done === "saved" && <Notice>{t("entries.saved")}</Notice>}
      {done === "approved" && <Notice>{t("entries.approved")}</Notice>}
      {done === "rejected" && <Notice>{t("entries.rejected")}</Notice>}
      {done === "unlocked" && <Notice>{t("entries.unlocked")}</Notice>}
      {entry.status === "REJECTED" && entry.rejectReason && <Notice tone="alert">{t("entries.rejectedBecause", { reason: entry.rejectReason })}</Notice>}

      <Card className="space-y-2">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {cfg.childCount && (
            <div>
              <dt className="text-sm text-ink-muted">{t("entries.childCount")}</dt>
              <dd className="font-medium">{n(entry.childCount)}</dd>
            </div>
          )}
          {cfg.header.map((f) => (
            <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2" : undefined}>
              <dt className="text-sm text-ink-muted">{t(`entries.fields.${f.name}`)}</dt>
              <dd className="font-medium">
                {fields[f.name] == null || fields[f.name] === ""
                  ? "—"
                  : f.type === "select"
                    ? t(`expenseCategories.${fields[f.name]}`)
                    : f.name === "total" || f.name === "perHeadRate"
                      ? formatINR(Number(fields[f.name]), { numerals })
                      : f.type === "date"
                        ? formatDate(`${fields[f.name]}T00:00:00Z`, { numerals })
                        : String(fields[f.name])}
              </dd>
            </div>
          ))}
          <div>
            <dt className="text-sm text-ink-muted">{t("entries.createdBy")}</dt>
            <dd className="font-medium">
              {entry.createdByName} · {formatDateTime(entry.createdAt, { numerals })}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-muted">{t("entries.approval")}</dt>
            <dd className="font-medium">
              {entry.approvedByName && entry.approvedAt
                ? t("entries.approvedBy", { name: entry.approvedByName, date: formatDateTime(entry.approvedAt, { numerals }) })
                : t(`status.${entry.status}`)}
            </dd>
          </div>
          {entry.remarks && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-ink-muted">{t("entries.remarks")}</dt>
              <dd>{entry.remarks}</dd>
            </div>
          )}
        </dl>
        {entry.overrideReason && <Notice tone="alert">{t("entries.overrideNote", { reason: entry.overrideReason })}</Notice>}
      </Card>

      {cfg.lineMode !== "none" && (
        <Card className="p-0 sm:p-0">
          <DataTable
            empty={t("common.noRecords")}
            columns={lineColumns}
            rows={entry.lines.map((l, i) => {
              const it = l.itemId ? names.get(l.itemId) : undefined;
              const unit = it ? t(`units.${it.unit}`) : "";
              const open = opening && l.itemId ? opening.get(l.itemId)?.approved ?? 0 : 0;
              const bal = round(open + (cfg.lineMode === "inout" ? l.inQty ?? 0 : 0) - (l.outQty ?? 0));
              return {
                key: String(i),
                cells: [
                  `${it?.name ?? "?"} (${unit})`,
                  ...(cfg.lineMode === "kind" ? [t(`kinds.${l.kind}`)] : []),
                  ...(showsBalance ? [n(open)] : []),
                  ...(cfg.lineMode === "inout" ? [n(l.inQty), n(l.outQty)] : [n(l.inQty ?? l.outQty)]),
                  ...(showsBalance ? [n(bal)] : []),
                  ...(cfg.lineExtras.includes("source") ? [t(`sources.${l.source ?? "purchased"}`)] : []),
                  ...(cfg.lineExtras.includes("rate") ? [l.amount != null ? formatINR(l.amount, { numerals }) : "—"] : []),
                  ...(cfg.lineExtras.includes("acknowledged") ? [l.acknowledged ? `✔ ${t("common.yes")}` : t("common.no")] : []),
                  ...(cfg.lineExtras.includes("note") || cfg.lineExtras.includes("donorName") ? [[l.donorName, l.note].filter(Boolean).join(" · ") || "—"] : []),
                ],
              };
            })}
          />
        </Card>
      )}

      {(editable || isAdmin) && (
        <Card className="space-y-4">
          <CardTitle>{t("common.actions")}</CardTitle>
          <div className="flex flex-wrap items-start gap-4">
            {editable && (
              <Link href={`/registers/${module}/${entry.id}/edit`} className={buttonVariants({ variant: "outline" })}>
                <Pencil size={18} aria-hidden />
                {t("entries.edit")}
              </Link>
            )}
            {isAdmin && entry.status === "PENDING" && (
              <ActionForm
                action={approveEntryAction}
                hidden={hidden}
                label={t("entries.approve")}
                reasonOnError={{ name: "overrideReason", label: t("entries.overrideReason"), whenMessage: "entries.insufficientApproved" }}
              />
            )}
          </div>
          {isAdmin && entry.status === "PENDING" && (
            <ActionForm action={rejectEntryAction} hidden={hidden} label={t("entries.reject")} variant="danger" reason={{ name: "reason", label: t("entries.rejectReason"), required: true }} />
          )}
          {isAdmin && entry.status === "APPROVED" && (
            <ActionForm action={unlockEntryAction} hidden={hidden} label={t("entries.unlock")} variant="outline" reason={{ name: "reason", label: t("entries.unlockReason"), required: true }} />
          )}
          {editable && <ActionForm action={deleteEntryAction} hidden={hidden} label={t("entries.delete")} variant="ghost" />}
        </Card>
      )}

      {cfg.header.some((f) => f.adminOnly) && (
        <Card className="space-y-3">
          <CardTitle>{t("entries.medicalVerification")}</CardTitle>
          {fields.medicalOfficerName ? (
            <p>
              {t("entries.medicalVerified", {
                name: String(fields.medicalOfficerName),
                date: fields.medicalOfficerDate ? formatDate(`${fields.medicalOfficerDate}T00:00:00Z`, { numerals }) : "—",
              })}
            </p>
          ) : (
            <p className="text-ink-muted">—</p>
          )}
          {isAdmin && (
            <AdminFieldsForm
              action={adminFieldsAction}
              hidden={hidden}
              fields={cfg.header.filter((f) => f.adminOnly).map((f) => ({ name: f.name, type: f.type, label: t(`entries.fields.${f.name}`), value: String(fields[f.name] ?? "") }))}
              submitLabel={t("common.save")}
            />
          )}
        </Card>
      )}
    </div>
  );
}
