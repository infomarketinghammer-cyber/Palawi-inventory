import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { Card, PageHeader } from "@/components/ui/card";
import { ItemForm } from "../item-form";
import { saveItem } from "../actions";

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAdmin();
  const item = await tenantDb(session.clientId).item.findFirst({ where: { id } });
  if (!item) notFound();
  const t = await getTranslations();
  const s = (v: unknown) => (v == null ? "" : String(v));
  return (
    <div className="space-y-6">
      <PageHeader title={t("items.edit")} />
      <Card>
        <ItemForm
          action={saveItem.bind(null, item.id)}
          initial={{
            code: item.code,
            nameMr: item.nameMr,
            nameEn: item.nameEn,
            category: item.category,
            group: s(item.group),
            unit: item.unit,
            reorderLevel: s(item.reorderLevel),
            perChildDailyNorm: s(item.perChildDailyNorm),
            location: s(item.location),
            trackExpiry: item.trackExpiry,
          }}
        />
      </Card>
    </div>
  );
}
