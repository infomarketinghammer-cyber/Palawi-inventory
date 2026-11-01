import { AlertOctagon, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { StockStatus } from "@/lib/stock";
import { Badge } from "./ui/card";

/** Stock status with icon + text. Out of stock uses the red alert colour (client decision). */
export async function StockBadge({ status }: { status: StockStatus }) {
  const t = await getTranslations("stockStatus");
  if (status === "out")
    return (
      <Badge tone="alert" icon={<AlertOctagon size={14} aria-hidden />}>
        {t("out")}
      </Badge>
    );
  if (status === "low")
    return (
      <Badge tone="alert" icon={<AlertTriangle size={14} aria-hidden />}>
        {t("low")}
      </Badge>
    );
  return (
    <Badge tone="ok" icon={<CheckCircle2 size={14} aria-hidden />}>
      {t("ok")}
    </Badge>
  );
}
