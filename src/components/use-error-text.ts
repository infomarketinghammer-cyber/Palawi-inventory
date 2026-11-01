"use client";

import { useTranslations } from "next-intl";

/**
 * Turns an error key from a server action into text.
 * "tooShort:8" -> validation.tooShort with {min: 8, max: 8}; "clients.codeTaken" -> that key as-is.
 */
export function useErrorText() {
  const t = useTranslations();
  return (key?: string) => {
    if (!key) return undefined;
    const [k, param] = key.split(":");
    const full = k.includes(".") ? k : `validation.${k}`;
    // Anything unexpected (e.g. a library's default English message) falls back to a generic bilingual one.
    if (!t.has(full)) return t("validation.invalid");
    return t(full, { min: param ?? "", max: param ?? "", minutes: param ?? "" });
  };
}
