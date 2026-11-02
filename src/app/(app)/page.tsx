import { Suspense } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  Apple,
  BookOpen,
  Carrot,
  CheckCircle2,
  Clock,
  DoorOpen,
  IndianRupee,
  PackagePlus,
  Scale,
  Shirt,
  SprayCan,
  UtensilsCrossed,
  Wheat,
} from "lucide-react";
import { requireUser, type Session } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { formatDate, formatDateTime, formatINR, formatNumber, type AppLocale, type NumeralStyle } from "@/lib/format";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { dashboardCharts, dashboardData } from "@/lib/dashboard";
import { Badge, Card, CardTitle, Notice } from "@/components/ui/card";
import { StockBadge } from "@/components/stock-badge";
import { ChartCard } from "@/components/chart-card";
import { HeatStrip } from "@/components/heat-strip";
import { Spinner } from "@/components/ui/spinner";

const CARDS = [
  { key: "grain", href: "/registers/grain", icon: Wheat, daily: true },
  { key: "meals", href: "/registers/meals", icon: UtensilsCrossed, daily: true },
  { key: "vegetables", href: "/registers/vegetables", icon: Carrot, daily: true },
  { key: "fruit", href: "/registers/fruit", icon: Apple, daily: true },
  { key: "personal", href: "/registers/personal", icon: Shirt },
  { key: "cleaning", href: "/registers/cleaning", icon: SprayCan },
  { key: "utensils", href: "/registers/utensils", icon: BookOpen },
  { key: "gate", href: "/gate", icon: DoorOpen },
  { key: "expenses", href: "/registers/expenses", icon: IndianRupee },
  { key: "purchase", href: "/registers/purchase", icon: PackagePlus },
  { key: "adjustment", href: "/registers/adjustment", icon: Scale, adminOnly: true },
] as const;

export default async function HomePage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const session = await requireUser();
  const t = await getTranslations();
  const { locale, numerals } = await getFormatPrefs();
  const { denied } = await searchParams;
  const isAdmin = session.role === "ADMIN";
  if (!session.institutionId) return <Notice tone="alert">{t("home.noInstitution")}</Notice>;
  const d = await dashboardData(tenantDb(session.clientId), session, locale);
  const n = (v: number) => formatNumber(v, { numerals });

  const kpis = [
    { label: t("dashboard.kpi.children"), value: d.kpis.children != null ? n(d.kpis.children) : "—" },
    { label: t("dashboard.kpi.lowStock"), value: n(d.kpis.lowStock), alert: d.kpis.lowStock > 0, href: "/stock" },
    { label: t("dashboard.kpi.pending"), value: n(d.kpis.pending), href: isAdmin ? "/approvals" : undefined },
    { label: t("dashboard.kpi.meals", { count: n(d.kpis.meals) }), value: `${n(d.kpis.meals)}/${n(4)}`, href: "/registers/meals" },
    ...(isAdmin
      ? [
          { label: t("dashboard.kpi.donations"), value: `${n(d.kpis.donations)}${d.kpis.donationCash ? ` · ${formatINR(d.kpis.donationCash, { numerals })}` : ""}`, href: "/donations" },
          { label: t("dashboard.kpi.visitorsToday"), value: n(d.kpis.visitorsToday), href: "/gate" },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      {denied && <Notice tone="alert">{t("common.denied")}</Notice>}
      <div>
        <h1 className="text-2xl font-semibold text-primary-800">{t("home.welcome", { name: session.name })}</h1>
        <p className="text-ink-muted">{t("home.signedInAs", { role: t(`roles.${session.role}`) })}</p>
      </div>

      <section aria-label={t("dashboard.title")} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => {
          const body = (
            <>
              <p className="text-sm text-ink-muted">{k.label}</p>
              <p className={`text-2xl font-semibold ${k.alert ? "text-alert-700" : "text-primary-800"}`}>
                {k.alert && <AlertTriangle size={18} aria-hidden className="mr-1 inline align-baseline" />}
                {k.value}
              </p>
            </>
          );
          return k.href ? (
            <Link key={k.label} href={k.href} className="rounded-card border border-primary-100 bg-white p-4 hover:border-primary-300">
              {body}
            </Link>
          ) : (
            <div key={k.label} className="rounded-card border border-primary-100 bg-white p-4">
              {body}
            </div>
          );
        })}
      </section>

      <Card>
        <CardTitle>{t("home.registersTitle")}</CardTitle>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {CARDS.filter((c) => !("adminOnly" in c) || isAdmin).map((c) => {
            const Icon = c.icon;
            const filled = "daily" in c && d.filledToday.includes(c.key);
            return (
              <li key={c.key}>
                <Link href={c.href} className="flex h-full items-start gap-3 rounded-xl border border-primary-100 bg-surface p-3 hover:border-primary-400 hover:bg-primary-50">
                  <Icon aria-hidden className="mt-0.5 shrink-0 text-primary-600" />
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-ink">{c.key === "gate" ? t("modules.gate") : t(`modules.${c.key}`)}</p>
                    {"daily" in c &&
                      (filled ? (
                        <Badge tone="ok" icon={<CheckCircle2 size={14} aria-hidden />}>
                          {t("dashboard.filled")}
                        </Badge>
                      ) : (
                        <Badge tone="pending" icon={<Clock size={14} aria-hidden />}>
                          {t("dashboard.missingLabel")}
                        </Badge>
                      ))}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <CardTitle>{t("dashboard.tasks")}</CardTitle>
          {d.missingToday.length === 0 ? (
            <p className="flex items-center gap-2 text-secondary-800">
              <CheckCircle2 size={18} aria-hidden />
              {t("dashboard.allFilled")}
            </p>
          ) : (
            <>
              <p className="text-sm text-ink-muted">{t("dashboard.missing")}</p>
              <ul className="flex flex-wrap gap-2">
                {d.missingToday.map((m) => (
                  <li key={m}>
                    <Link href={`/registers/${m}/new`} className="inline-flex min-h-11 items-center rounded-xl border border-primary-300 bg-white px-3 text-primary-800 hover:bg-primary-50">
                      + {t(`modules.${m}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {d.myPending.length > 0 && (
            <>
              <p className="pt-2 text-sm text-ink-muted">{t("dashboard.myPending")}</p>
              <ul className="space-y-1">
                {d.myPending.map((p) => (
                  <li key={p.id}>
                    <Link href={`/registers/${p.module}/${p.id}`} className="text-primary-800 hover:underline">
                      {formatDate(p.date, { numerals })} — {t(`modules.${p.module}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
        <Card className="space-y-3">
          <CardTitle>{t("stock.lowStock")}</CardTitle>
          {d.lowStock.length === 0 ? (
            <p className="text-ink-muted">{t("dashboard.noData")}</p>
          ) : (
            <ul className="space-y-2">
              {d.lowStock.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/stock/${s.id}`} className="text-primary-800 hover:underline">
                    {s.name}: {n(s.balance)} {t(`units.${s.unit}`)}
                  </Link>
                  <StockBadge status={s.status} />
                </li>
              ))}
            </ul>
          )}
          <Link href="/registers/purchase/new" className="inline-flex min-h-11 items-center rounded-xl bg-primary-600 px-4 text-white hover:bg-primary-700">
            + {t("stock.addPurchase")}
          </Link>
        </Card>
      </div>

      {isAdmin && (
        <Suspense fallback={<Spinner label={t("common.loading")} />}>
          <Charts session={session} locale={locale} numerals={numerals} />
        </Suspense>
      )}
    </div>
  );
}

/** Admin charts: streamed in after the KPIs, so the top of the page shows straight away. */
async function Charts({ session, locale, numerals }: { session: Session; locale: AppLocale; numerals: NumeralStyle }) {
  const t = await getTranslations();
  const c = await dashboardCharts(tenantDb(session.clientId), session, locale);
  const n = (v: number) => formatNumber(v, { numerals });
  const short = (day: string) => formatDate(new Date(`${day}T00:00:00Z`), { numerals }).slice(0, 5);
  const month = (m: string) => `${m.slice(5, 7)}/${m.slice(2, 4)}`;
  const chartLabels = { table: t("dashboard.table"), chart: t("dashboard.chart"), csv: t("dashboard.csv"), noData: t("dashboard.noData"), item: t("entries.item") };

  return (
    <section aria-label={t("dashboard.title")} className="grid gap-4 lg:grid-cols-2">
      <ChartCard
        title={t("dashboarc.stockLevels")}
        kind="hbar"
        labels={chartLabels}
        alertLabel={t("stockStatus.low")}
        series={[
          { key: "balance", label: t("stock.balance") },
          { key: "reorder", label: t("stock.reorderLevel") },
        ]}
        rows={c.stockLevels.map((s) => ({ label: s.name, balance: s.balance, reorder: s.reorder, alert: s.alert }))}
      />
      <ChartCard
        title={t("dashboarc.daysLeft")}
        kind="hbar"
        labels={chartLabels}
        alertLabel={t("stockStatus.low")}
        series={[{ key: "days", label: t("stock.daysLeft") }]}
        rows={c.daysLeft.map((s) => ({ label: s.name, days: s.days, alert: s.alert }))}
      />
      <ChartCard
        title={t("dashboarc.consumption")}
        kind="line"
        unit={t("units.kg")}
        labels={chartLabels}
        series={[
          { key: "daily", label: t("entries.outQty") },
          { key: "avg7", label: t("dashboard.avg7") },
        ]}
        rows={c.consumption.map((c) => ({ label: short(c.day), daily: c.daily, avg7: c.avg7 }))}
      />
      <ChartCard
        title={t("dashboarc.inOut")}
        kind="bar"
        unit={t("units.kg")}
        labels={chartLabels}
        series={[
          { key: "in", label: t("stock.in") },
          { key: "out", label: t("stock.out") },
        ]}
        rows={c.inOut.map((w) => ({ label: short(w.week), in: w.in, out: w.out }))}
      />
      <ChartCard
        title={t("dashboarc.vegGroups")}
        kind="hbar"
        unit={t("units.kg")}
        labels={chartLabels}
        series={[{ key: "kg", label: t("entries.qty") }]}
        rows={c.vegGroups.map((v) => ({ label: t(`vegGroups.${v.group}`), kg: v.kg }))}
      />
      <ChartCard
        title={t("dashboarc.fruitSource")}
        kind="bar"
        labels={chartLabels}
        series={[
          { key: "purchased", label: t("sources.purchased") },
          { key: "donated", label: t("sources.donated") },
        ]}
        rows={c.fruit.map((f) => ({ label: month(f.month), purchased: f.purchased, donated: f.donated }))}
      />
      <HeatStrip
        title={t("dashboarc.mealCompleteness")}
        cells={c.mealCompleteness.map((m) => ({
          key: m.day,
          label: n(Number(m.day.slice(8))),
          value: m.state === "approved" ? "✔" : m.state === "filled" ? "•" : "✕",
          level: m.state === "approved" ? 4 : m.state === "filled" ? 2 : 0,
          title: `${short(m.day)}: ${t(m.state === "approved" ? "dashboard.approvedLabel" : m.state === "filled" ? "dashboard.filled" : "dashboard.missingLabel")}`,
        }))}
        legend={[
          { label: `✔ ${t("dashboard.approvedLabel")}`, level: 4 },
          { label: `• ${t("dashboard.filled")}`, level: 2 },
          { label: `✕ ${t("dashboard.missingLabel")}`, level: 0 },
        ]}
      />
      <ChartCard
        title={t("dashboarc.pendingByModule")}
        kind="hbar"
        labels={chartLabels}
        series={[{ key: "count", label: t("status.PENDING") }]}
        rows={c.pendingByModule.map((p) => ({ label: t(`modules.${p.module}`), count: p.count }))}
      />
      <ChartCard
        title={t("dashboarc.visitorsMonthly")}
        kind="line"
        labels={chartLabels}
        series={[{ key: "count", label: t("gate.visitCount") }]}
        rows={c.visitsMonthly.map((v) => ({ label: month(v.month), count: v.count }))}
      />
      <ChartCard
        title={t("dashboarc.purposes")}
        kind="hbar"
        labels={chartLabels}
        series={[{ key: "count", label: t("gate.visitCount") }]}
        rows={c.purposes.map((p) => ({
          label: p.purpose === "NONE" ? "—" : p.purpose === "OTHER_REST" ? t("gate.purposes.OTHER") + " +" : t(`gate.purposes.${p.purpose}`),
          count: p.count,
        }))}
      />
      <ChartCard
        title={t("dashboarc.newRepeat")}
        kind="bar"
        labels={chartLabels}
        series={[{ key: "count", label: t("gate.visitors") }]}
        rows={[
          { label: t("dashboard.newVisitors"), count: c.newRepeat.new },
          { label: t("dashboard.repeatVisitors"), count: c.newRepeat.repeat },
        ]}
      />
      <HeatStrip
        title={t("dashboarc.weekday")}
        cells={(() => {
          const names = t("dashboard.weekdays").split(",");
          const max = Math.max(1, ...c.weekday);
          return c.weekday.map((v, i) => ({ key: String(i), label: names[i], value: n(v), level: Math.round((v / max) * 5), title: `${names[i]}: ${v}` }));
        })()}
      />
      <ChartCard
        title={t("dashboarc.donationTypes")}
        kind="hbar"
        labels={chartLabels}
        series={[{ key: "count", label: t("donations.title") }]}
        rows={c.donationTypes.map((x) => ({ label: t(`donations.types.${x.type}`), count: x.count }))}
      />
      <ChartCard
        title={t("donations.title")}
        kind="bar"
        labels={chartLabels}
        series={[{ key: "count", label: t("donations.title") }]}
        rows={c.donationsMonthly.map((x) => ({ label: month(x.month), count: x.count }))}
      />
      <ChartCard
        title={t("dashboarc.expenses")}
        kind="hbar"
        unit="₹"
        labels={chartLabels}
        series={[{ key: "total", label: t("entries.total") }]}
        rows={c.expenses.map((x) => ({ label: t(`expenseCategories.${x.category}`), total: x.total }))}
      />
      <Card className="space-y-2 p-4 sm:p-5">
        <h3 className="font-semibold text-primary-800">{t("dashboard.recent")}</h3>
        <ul className="space-y-1 text-sm">
          {c.recent.map((r) => (
            <li key={r.id} className="flex flex-wrap gap-x-2">
              <span className="text-ink-muted">{formatDateTime(r.at, { numerals })}</span>
              <span>{r.who ?? t("audit.system")}</span>
              <span>
                {t.has(`audit.actions.${r.action}`) ? t(`audit.actions.${r.action}`) : r.action} · {t.has(`audit.entities.${r.entity}`) ? t(`audit.entities.${r.entity}`) : r.entity}
              </span>
            </li>
          ))}
        </ul>
        <Link href="/audit" className="text-sm text-primary-800 hover:underline">
          {t("nav.audit")} →
        </Link>
      </Card>
    </section>
  );
}
