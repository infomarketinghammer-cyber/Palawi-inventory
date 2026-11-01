import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant";
import { getFormatPrefs } from "@/lib/i18n-helpers";
import { validMonth } from "@/lib/ui-data";
import { monthlyStatement } from "@/lib/statement";
import { xlsxResponse } from "@/lib/xlsx";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.institutionId) return new Response("Unauthorized", { status: 401 });
  const month = validMonth(new URL(req.url).searchParams.get("month") ?? undefined);
  const { locale } = await getFormatPrefs();
  const t = await getTranslations({ locale });
  const rows = await monthlyStatement(tenantDb(session.clientId), session.institutionId, month, locale);
  return xlsxResponse(
    `stock-statement-${month}.xlsx`,
    [`${t("stock.statement")} — ${month}`],
    [t("entries.item"), t("entries.unit"), t("stock.category"), t("stock.opening"), t("stock.received"), t("stock.consumed"), t("stock.closing")],
    rows.map((r) => [r.name, t(`units.${r.unit}`), t(`categories.${r.category}`), r.opening, r.received, r.consumed, r.closing]),
  );
}
