import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertTriangle, Plus, Search, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { formatDate, formatNumber, literalSearch, maskMobile } from "@/lib/format";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { monthRange, validMonth } from "@/lib/ui-data";
import { dateToDay } from "@/lib/entries";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { MonthNav, monthLabel } from "@/components/month-nav";
import { StatusBadge } from "@/components/status-badge";

export async function generateMetadata() {
  return { title: (await getTranslations("gate"))("title") };
}

export default async function GatePage({ searchParams }: { searchParams: Promise<{ month?: string; q?: string }> }) {
  const session = await requireUser();
  const sp = await searchParams;
  const month = validMonth(sp.month);
  const q = (sp.q ?? "").trim().slice(0, 50);
  const t = await getTranslations();
  const { numerals } = await getFormatPrefs();
  const db = tenantDb(session.clientId);
  const { start, end } = monthRange(month);
  const isAdmin = session.role === "ADMIN";

  const visits = await db.visit.findMany({
    where: {
      ...(session.institutionId ? { institutionId: session.institutionId } : {}),
      ...(q
        ? { OR: [{ visitorName: { contains: literalSearch(q), mode: "insensitive" } }, { mobile: { contains: literalSearch(q.replace(/\D/g, "") || q) } }] }
        : { date: { gte: start, lt: end } }),
    },
    orderBy: [{ date: "desc" }, { serialNo: "asc" }],
    take: q ? 200 : 2000,
  });
  const byDay = new Map<string, typeof visits>();
  for (const v of visits) byDay.set(dateToDay(v.date), [...(byDay.get(dateToDay(v.date)) ?? []), v]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("gate.title")}>
        <div className="flex flex-wrap gap-2">
          {!isAdmin && (
            <Link href="/gate/new" className={buttonVariants()}>
              <Plus size={18} aria-hidden />
              {t("gate.newVisit")}
            </Link>
          )}
          <Link href="/gate/visitors" className={buttonVariants({ variant: "outline" })}>
            <Users size={18} aria-hidden />
            {t("gate.visitors")}
          </Link>
        </div>
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthNav base="/gate" month={month} label={monthLabel(month, numerals)} />
        <form className="flex w-full max-w-sm gap-2" role="search">
          <label htmlFor="q" className="sr-only">
            {t("gate.search")}
          </label>
          <Input id="q" name="q" defaultValue={q} placeholder={t("gate.search")} />
          <input type="hidden" name="month" value={month} />
          <button type="submit" className={buttonVariants({ variant: "outline" })} aria-label={t("gate.search")}>
            <Search size={18} aria-hidden />
          </button>
        </form>
      </div>

      {visits.length === 0 && (
        <Card>
          <p className="text-ink-muted">{t("gate.noVisits")}</p>
        </Card>
      )}
      {[...byDay].map(([day, list]) => (
        <Card key={day} className="p-0 sm:p-0">
          <h2 className="flex items-center justify-between border-b border-primary-100 bg-primary-50 px-4 py-2 font-semibold text-primary-900">
            <span>{formatDate(new Date(`${day}T00:00:00Z`), { numerals })}</span>
            <span className="text-sm font-normal">{t("gate.visitsOn", { count: formatNumber(list.length, { numerals }) })}</span>
          </h2>
          <ul className="divide-y divide-primary-50">
            {list.map((v) => (
              <li key={v.id}>
                <Link href={`/gate/${v.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface">
                  <span className="w-8 text-sm text-ink-muted">{v.serialNo ?? "–"}</span>
                  <span className="min-w-40 flex-1 font-medium">{v.visitorName}</span>
                  <span className="text-sm text-ink-muted">{isAdmin ? v.mobile : maskMobile(v.mobile)}</span>
                  <span className="text-sm">{v.purpose ? t(`gate.purposes.${v.purpose}`) : "—"}</span>
                  {v.flags.some((f) => f !== "NO_PURPOSE" && f !== "NO_SERIAL") && (
                    <Badge tone="neutral" icon={<AlertTriangle size={14} aria-hidden />}>
                      {t("gate.flagged")}
                    </Badge>
                  )}
                  {v.status !== "APPROVED" && <StatusBadge status={v.status} />}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
