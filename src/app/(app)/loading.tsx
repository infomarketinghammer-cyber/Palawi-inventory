import { getTranslations } from "next-intl/server";
import { PageLoading } from "@/components/ui/spinner";

// Shown instantly while a page's data loads; the header and menu stay in place.
export default async function Loading() {
  const t = await getTranslations("common");
  return <PageLoading label={t("loading")} />;
}
