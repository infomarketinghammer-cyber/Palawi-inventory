import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/session-token";

export const LOCALES = ["mr", "en"] as const;
export const DEFAULT_LOCALE = "mr";
export const NUMERALS_COOKIE = "NUMERALS";

// The language lives in a cookie (no locale in the URL). It is set from the user's saved
// preference at login and whenever they use the language switch.
export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = store.get(LOCALE_COOKIE)?.value === "en" ? "en" : DEFAULT_LOCALE;
  return {
    locale,
    timeZone: "Asia/Kolkata",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
