// Locale-aware formatting helpers. Pure functions (no imports) so they can be unit tested with node --test.

export type AppLocale = "mr" | "en";
export type NumeralStyle = "latin" | "deva";

const DEVA_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

/** Replace ASCII digits 0-9 with Devanagari digits ०-९. */
export function toDevanagariDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => DEVA_DIGITS[Number(d)]);
}

function digits(s: string, numerals: NumeralStyle): string {
  return numerals === "deva" ? toDevanagariDigits(s) : s;
}

/** Indian digit grouping: 12,34,567.89 */
export function formatNumber(n: number, opts: { numerals?: NumeralStyle; maxFractionDigits?: number } = {}): string {
  const s = new Intl.NumberFormat("en-IN", { maximumFractionDigits: opts.maxFractionDigits ?? 2 }).format(n);
  return digits(s, opts.numerals ?? "latin");
}

/** ₹ with Indian grouping, e.g. ₹3,000 or ₹1,23,456.50 */
export function formatINR(n: number, opts: { numerals?: NumeralStyle } = {}): string {
  const s = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
  return digits(s, opts.numerals ?? "latin");
}

/** DD/MM/YYYY in Asia/Kolkata. */
export function formatDate(d: Date | string, opts: { numerals?: NumeralStyle } = {}): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return digits(`${get("day")}/${get("month")}/${get("year")}`, opts.numerals ?? "latin");
}

/** DD/MM/YYYY HH:mm (24h) in Asia/Kolkata. */
export function formatDateTime(d: Date | string, opts: { numerals?: NumeralStyle } = {}): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${formatDate(date, opts)} ${digits(time, opts.numerals ?? "latin")}`;
}

/** Pick the active-language name from a bilingual record, falling back to the other language. */
export function localName(rec: { nameMr?: string | null; nameEn?: string | null }, locale: AppLocale): string {
  const primary = locale === "mr" ? rec.nameMr : rec.nameEn;
  const fallback = locale === "mr" ? rec.nameEn : rec.nameMr;
  return (primary && primary.trim()) || (fallback && fallback.trim()) || "";
}

/** 9876543210 -> 98XXXXX210 (visitor privacy for roles that do not need the full number). */
export function maskMobile(mobile: string | null | undefined): string {
  if (!mobile) return "";
  return mobile.length < 6 ? "XXXX" : `${mobile.slice(0, 2)}${"X".repeat(mobile.length - 5)}${mobile.slice(-3)}`;
}

/** Normalise an Indian mobile number to 10 digits, or null if it cannot be. */
export function normalizeMobile(input: string | number | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  let s = String(input).replace(/\D/g, "");
  if (s.length === 12 && s.startsWith("91")) s = s.slice(2);
  if (s.length === 11 && s.startsWith("0")) s = s.slice(1);
  return /^[6-9]\d{9}$/.test(s) ? s : null;
}
