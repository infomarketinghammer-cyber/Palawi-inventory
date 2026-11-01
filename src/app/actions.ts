"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { endSession, getSession } from "@/lib/auth";
import { LOCALE_COOKIE } from "@/lib/session-token";
import { NUMERALS_COOKIE } from "@/i18n/request";

const YEAR = 60 * 60 * 24 * 365;

/** Switch language. Remembered in a cookie and, when logged in, on the user record. */
export async function setLocale(locale: string) {
  const value = locale === "en" ? "en" : "mr";
  (await cookies()).set(LOCALE_COOKIE, value, { path: "/", maxAge: YEAR, sameSite: "lax" });
  const session = await getSession();
  if (session) await prisma.user.update({ where: { id: session.userId }, data: { locale: value } });
  revalidatePath("/", "layout");
}

export async function setNumerals(style: string) {
  (await cookies()).set(NUMERALS_COOKIE, style === "deva" ? "deva" : "latin", { path: "/", maxAge: YEAR, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function logout() {
  await endSession();
  redirect("/login");
}
