"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/app/actions";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "mr", label: "मराठी" },
  { value: "en", label: "EN" },
] as const;

export function LanguageSwitch({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("common");
  const [pending, start] = useTransition();

  return (
    <div role="group" aria-label={t("language")} className={cn("inline-flex rounded-full border border-primary-200 bg-white p-0.5", className)}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          lang={o.value}
          aria-pressed={locale === o.value}
          disabled={pending}
          onClick={() => start(() => setLocale(o.value))}
          className={cn(
            "min-h-9 min-w-12 rounded-full px-3 text-sm font-medium",
            locale === o.value ? "bg-primary-600 text-white" : "text-primary-800 hover:bg-primary-50",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
