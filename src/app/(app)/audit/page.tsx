import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { formatDateTime } from "@/lib/format";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { Card, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";

export async function generateMetadata() {
  return { title: (await getTranslations("audit"))("title") };
}

const PAGE_SIZE = 100;

function summarise(v: unknown): string {
  if (!v || typeof v !== "object") return "";
  return Object.entries(v as Record<string, unknown>)
    .filter(([, val]) => val !== null && val !== undefined && val !== "")
    .map(([k, val]) => `${k}: ${typeof val === "object" ? JSON.stringify(val) : String(val)}`)
    .join(", ");
}

export default async function AuditPage() {
  const session = await requireAdmin();
  const t = await getTranslations();
  const { numerals } = await getFormatPrefs();
  const logs = await tenantDb(session.clientId).auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    include: { user: { select: { name: true } } },
  });
  const label = (ns: string, key: string) => (t.has(`${ns}.${key}`) ? t(`${ns}.${key}`) : key);

  return (
    <div className="space-y-6">
      <PageHeader title={t("audit.title")} intro={t("audit.intro")} />
      <Card className="p-0 sm:p-0">
        <DataTable
          empty={t("common.noRecords")}
          columns={[t("audit.when"), t("audit.who"), t("audit.action"), t("audit.entity"), t("audit.details")]}
          rows={logs.map((l) => ({
            key: l.id,
            cells: [
              <span key="w" className="whitespace-nowrap text-sm">{formatDateTime(l.createdAt, { numerals })}</span>,
              l.user?.name ?? t("audit.system"),
              label("audit.actions", l.action),
              label("audit.entities", l.entity),
              <span key="d" className="block max-w-md text-sm text-ink-muted">
                {[l.oldValue ? `− ${summarise(l.oldValue)}` : "", l.newValue ? `+ ${summarise(l.newValue)}` : "", l.reason ?? ""]
                  .filter(Boolean)
                  .join(" | ")}
              </span>,
            ],
          }))}
        />
      </Card>
    </div>
  );
}
