import "server-only";
import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { NUMERALS_COOKIE } from "@/i18n/request";
import type { AppLocale, NumeralStyle } from "./format";

/** Current language and numeral style for server components. */
export async function getFormatPrefs(): Promise<{ locale: AppLocale; numerals: NumeralStyle }> {
  const locale = (await getLocale()) === "en" ? "en" : "mr";
  const numerals = (await cookies()).get(NUMERALS_COOKIE)?.value === "deva" ? "deva" : "latin";
  return { locale, numerals };
}
