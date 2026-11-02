import { getTranslations } from "next-intl/server";
import { PageLoading } from "@/components/ui/spinner";

// First load (before the signed-in layout is ready).
export default async function Loading() {
  const t = await getTranslations("common");
  return <PageLoading label={t("loading")} />;
}
