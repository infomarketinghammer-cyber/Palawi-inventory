import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, FileDown } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { formatDate, formatINR, formatNumber, maskMobile } from "@/lib/format";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { Card, CardTitle, Notice, PageHeader } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { ActionForm } from "@/components/action-form";
import { approveVisitAction, rejectVisitAction } from "../actions";

export default async function VisitPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  const { id } = await params;
  const session = await requireUser();
  const db = tenantDb(session.clientId);
  const visit = await db.visit.findFirst({ where: { id } });
  if (!visit) notFound();
  const [donations, visitor] = await Promise.all([
    db.donation.findMany({ where: { visitId: id } }),
    visit.visitorId ? db.visitor.findFirst({ where: { id: visit.visitorId } }) : null,
  ]);
  const { done } = await searchParams;
  const t = await getTranslations();
  const { numerals } = await getFormatPrefs();
  const isAdmin = session.role === "ADMIN";
  const row = (label: string, value: React.ReactNode) => (
    <div>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );

  return (
    <div className="space-y-6">
      <Link href={`/gate?month=${visit.date.toISOString().slice(0, 7)}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <ArrowLeft size={16} aria-hidden />
        {t("gate.title")}
      </Link>
      <PageHeader title={visit.visitorName}>
        <StatusBadge status={visit.status} />
      </PageHeader>
      {done === "saved" && <Notice>{t("gate.saved")}</Notice>}
      {done === "approved" && <Notice>{t("entries.approved")}</Notice>}
      {done === "rejected" && <Notice>{t("entries.rejected")}</Notice>}

      <Card>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {row(t("entries.date"), formatDate(visit.date, { numerals }))}
          {row(t("gate.time"), visit.time)}
          {row(t("gate.serialNo"), visit.serialNo != null ? formatNumber(visit.serialNo, { numerals }) : null)}
          {row(t("gate.visitNo"), visit.visitNo != null ? formatNumber(visit.visitNo, { numerals }) : null)}
          {row(t("gate.mobile"), isAdmin ? visit.mobile : visit.mobile ? `${maskMobile(visit.mobile)} ${t("gate.masked")}` : null)}
          {isAdmin && row(t("gate.dob"), visit.dob ? formatDate(visit.dob, { numerals }) : null)}
          {row(t("gate.address"), visit.address)}
          {row(t("gate.purpose"), visit.purpose ? t(`gate.purposes.${visit.purpose}`) : visit.purposeRaw)}
          {row(t("gate.extraRemark"), visit.extraRemark)}
          {visitor && row(t("gate.visitCount"), formatNumber(visitor.visitCount, { numerals }))}
        </dl>
        {visit.flags.filter((f) => f !== "NO_PURPOSE" && f !== "NO_SERIAL").length > 0 && (
          <p className="mt-3 text-sm text-ink-muted">
            {t("gate.flagged")}: {visit.flags.map((f) => t(`gate.flags.${f}`)).join(", ")}
          </p>
        )}
      </Card>

      {donations.map((d) => (
        <Card key={d.id} className="space-y-2">
          <CardTitle>{t("gate.donationSection")}</CardTitle>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {row(t("donations.type"), t(`donations.types.${d.type}`))}
            {d.amount != null && row(t("donations.amount"), formatINR(d.amount, { numerals }))}
            {row(t("donations.description"), d.description)}
            {row(t("donations.receiptNo"), d.receiptNo)}
          </dl>
          <div className="flex flex-wrap gap-2">
            {d.status === "APPROVED" ? (
              <a href={`/donations/${d.id}/receipt`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <FileDown size={16} aria-hidden />
                {t("donations.downloadReceipt")}
              </a>
            ) : (
              <span className="text-sm text-ink-muted">{t("donations.notApproved")}</span>
            )}
            {d.entryId && (
              <Link href={`/registers/purchase/${d.entryId}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                {t("donations.stockEntry")}
              </Link>
            )}
          </div>
        </Card>
      ))}

      {isAdmin && visit.status === "PENDING" && (
        <Card className="space-y-4">
          <CardTitle>{t("common.actions")}</CardTitle>
          <ActionForm action={approveVisitAction} hidden={{ id: visit.id, back: `/gate/${visit.id}` }} label={t("entries.approve")} />
          <ActionForm action={rejectVisitAction} hidden={{ id: visit.id, back: `/gate/${visit.id}` }} label={t("entries.reject")} variant="danger" reason={{ name: "reason", label: t("entries.rejectReason"), required: true }} />
        </Card>
      )}
    </div>
  );
}
