import { getTranslations } from "next-intl/server";
import { Search } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { formatDate, formatNumber, maskMobile } from "@/lib/format";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { Card, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Input } from "@/components/ui/form";
import { buttonVariants } from "@/components/ui/button";

export default async function VisitorsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await requireUser();
  const q = ((await searchParams).q ?? "").trim().slice(0, 50);
  const t = await getTranslations();
  const { numerals } = await getFormatPrefs();
  const isAdmin = session.role === "ADMIN";
  const visitors = await tenantDb(session.clientId).visitor.findMany({
    where: {
      ...(session.institutionId ? { institutionId: session.institutionId } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { mobile: { contains: q.replace(/\D/g, "") || q } }] } : {}),
    },
    orderBy: [{ visitCount: "desc" }, { lastVisitAt: "desc" }],
    take: 200,
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("gate.visitors")} />
      <form className="flex max-w-sm gap-2" role="search">
        <label htmlFor="q" className="sr-only">
          {t("gate.search")}
        </label>
        <Input id="q" name="q" defaultValue={q} placeholder={t("gate.search")} />
        <button type="submit" className={buttonVariants({ variant: "outline" })} aria-label={t("gate.search")}>
          <Search size={18} aria-hidden />
        </button>
      </form>
      <Card className="p-0 sm:p-0">
        <DataTable
          empty={t("common.noRecords")}
          columns={[t("gate.visitorName"), t("gate.mobile"), t("gate.address"), t("gate.visitCount"), t("gate.firstVisit"), t("gate.lastVisit")]}
          rows={visitors.map((v) => ({
            key: v.id,
            cells: [
              v.name,
              isAdmin ? v.mobile ?? "" : maskMobile(v.mobile),
              v.address ?? "",
              formatNumber(v.visitCount, { numerals }),
              v.firstVisitAt ? formatDate(v.firstVisitAt, { numerals }) : "",
              v.lastVisitAt ? formatDate(v.lastVisitAt, { numerals }) : "",
            ],
          }))}
        />
      </Card>
    </div>
  );
}
