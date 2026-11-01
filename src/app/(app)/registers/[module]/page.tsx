import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { FileSpreadsheet, Plus, Printer } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { isModuleKey, MODULES } from "@/lib/modules";
import { formatDate, formatNumber } from "@/lib/format";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { itemNames, monthRange, validMonth } from "@/lib/ui-data";
import { summarise } from "@/lib/entry-view";
import { dateToDay } from "@/lib/entries";
import { Card, Notice, PageHeader } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { MonthNav, monthLabel } from "@/components/month-nav";

export async function generateMetadata({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const t = await getTranslations("modules");
  return { title: isModuleKey(module) ? t(module) : "" };
}

const STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams: Promise<{ month?: string; status?: string; done?: string }>;
}) {
  const { module } = await params;
  if (!isModuleKey(module)) notFound();
  const cfg = MODULES[module];
  const session = await requireUser();
  const sp = await searchParams;
  const month = validMonth(sp.month);
  const status = STATUSES.find((s) => s === sp.status);
  const t = await getTranslations();
  const { locale, numerals } = await getFormatPrefs();
  const db = tenantDb(session.clientId);
  const { start, end } = monthRange(month);

  const [entries, names] = await Promise.all([
    db.entry.findMany({
      where: {
        module,
        date: { gte: start, lt: end },
        ...(session.institutionId ? { institutionId: session.institutionId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    itemNames(db, locale),
  ]);

  const summaries = new Map(await Promise.all(entries.map(async (e) => [e.id, await summarise(e, names, numerals)] as const)));
  const byDay = new Map<string, typeof entries>();
  for (const e of entries) byDay.set(dateToDay(e.date), [...(byDay.get(dateToDay(e.date)) ?? []), e]);
  const canCreate = cfg.createRoles.includes(session.role);
  const q = `month=${month}`;

  return (
    <div className="space-y-6">
      <PageHeader title={t(`modules.${module}`)}>
        <div className="flex flex-wrap gap-2">
          {canCreate && (
            <Link href={`/registers/${module}/new`} className={buttonVariants()}>
              <Plus size={18} aria-hidden />
              {t("entries.new")}
            </Link>
          )}
          <Link href={`/registers/${module}/print?${q}`} className={buttonVariants({ variant: "outline" })}>
            <Printer size={18} aria-hidden />
            {t("entries.print")}
          </Link>
          <a href={`/registers/${module}/export?${q}`} className={buttonVariants({ variant: "outline" })}>
            <FileSpreadsheet size={18} aria-hidden />
            {t("entries.export")}
          </a>
        </div>
      </PageHeader>

      {sp.done === "deleted" && <Notice>{t("entries.deleted")}</Notice>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthNav base={`/registers/${module}`} month={month} label={monthLabel(month, numerals)} extra={status ? `&status=${status}` : ""} />
        <nav className="flex flex-wrap gap-1" aria-label={t("entries.status")}>
          {[undefined, ...STATUSES].map((s) => (
            <Link
              key={s ?? "all"}
              href={`/registers/${module}?${q}${s ? `&status=${s}` : ""}`}
              aria-current={s === status ? "page" : undefined}
              className={buttonVariants({ variant: s === status ? "primary" : "outline", size: "sm" })}
            >
              {s ? t(`status.${s}`) : t("entries.allStatuses")}
            </Link>
          ))}
        </nav>
      </div>

      {entries.length === 0 ? (
        <Card>
          <p className="text-ink-muted">{t("entries.noEntries")}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {[...byDay].map(([day, list]) => (
            <section key={day} aria-labelledby={`d-${day}`}>
              <h2 id={`d-${day}`} className="mb-2 font-semibold text-primary-800">
                {formatDate(new Date(`${day}T00:00:00Z`), { numerals })}
              </h2>
              <ul className="space-y-2">
                {list.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/registers/${module}/${e.id}`}
                        className="flex flex-col gap-2 rounded-card border border-primary-100 bg-white p-4 hover:border-primary-300 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="text-ink">{summaries.get(e.id)}</p>
                          <p className="text-sm text-ink-muted">
                            {cfg.childCount && e.childCount != null && `${t("entries.childCount")}: ${formatNumber(e.childCount, { numerals })} · `}
                            {t("entries.createdBy")}: {e.createdByName}
                          </p>
                        </div>
                        <StatusBadge status={e.status} />
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
