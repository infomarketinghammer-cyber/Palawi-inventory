import { getTranslations } from "next-intl/server";
import { CheckCircle2, CircleSlash } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { formatDateTime, localName } from "@/lib/format";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { NewUserForm } from "./new-user-form";
import { ToggleActiveButton } from "./toggle-active-button";

export async function generateMetadata() {
  return { title: (await getTranslations("users"))("title") };
}

export default async function UsersPage() {
  const session = await requireAdmin();
  const t = await getTranslations();
  const { locale, numerals } = await getFormatPrefs();
  const db = tenantDb(session.clientId);
  const [users, institutions] = await Promise.all([
    db.user.findMany({ orderBy: [{ role: "desc" }, { name: "asc" }], include: { institution: true } }),
    db.institution.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("users.title")} />
      <Card className="p-0 sm:p-0">
        <DataTable
          empty={t("common.noRecords")}
          columns={[t("users.name"), t("users.role"), t("users.institution"), t("users.lastLogin"), t("users.status"), t("common.actions")]}
          rows={users.map((u) => ({
            key: u.id,
            cells: [
              <span key="n">
                <span className="block font-medium">{u.name}</span>
                <span className="block text-sm text-ink-muted">{[u.phone, u.email].filter(Boolean).join(" · ")}</span>
              </span>,
              t(`roles.${u.role}`),
              u.institution ? localName(u.institution, locale) : t("users.allInstitutions"),
              u.lastLoginAt ? formatDateTime(u.lastLoginAt, { numerals }) : t("users.never"),
              u.active ? (
                <Badge key="s" tone="ok" icon={<CheckCircle2 size={14} aria-hidden />}>
                  {t("common.active")}
                </Badge>
              ) : (
                <Badge key="s" tone="neutral" icon={<CircleSlash size={14} aria-hidden />}>
                  {t("common.inactive")}
                </Badge>
              ),
              u.id === session.userId ? null : (
                <ToggleActiveButton
                  key="a"
                  userId={u.id}
                  active={u.active}
                  label={u.active ? t("users.deactivate") : t("users.activate")}
                />
              ),
            ],
          }))}
        />
      </Card>
      <NewUserForm institutions={institutions.map((i) => ({ id: i.id, name: localName(i, locale) }))} />
    </div>
  );
}
