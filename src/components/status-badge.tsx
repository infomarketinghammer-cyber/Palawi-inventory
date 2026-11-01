import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Badge } from "./ui/card";

/** Approval status: icon + text, never colour alone. */
export async function StatusBadge({ status }: { status: string }) {
  const t = await getTranslations("status");
  if (status === "APPROVED")
    return (
      <Badge tone="ok" icon={<CheckCircle2 size={14} aria-hidden />}>
        {t("APPROVED")}
      </Badge>
    );
  if (status === "REJECTED")
    return (
      <Badge tone="alert" icon={<XCircle size={14} aria-hidden />}>
        {t("REJECTED")}
      </Badge>
    );
  return (
    <Badge tone="pending" icon={<Clock size={14} aria-hidden />}>
      {t("PENDING")}
    </Badge>
  );
}
