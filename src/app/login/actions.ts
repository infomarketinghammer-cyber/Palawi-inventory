"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { startSession } from "@/lib/auth";
import { normalizeMobile } from "@/lib/format";
import { verifyPassword } from "@/lib/password";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { LOCALE_COOKIE } from "@/lib/session-token";
import { loginSchema, type ActionState } from "@/lib/validation";

const WINDOW_MS = 15 * 60 * 1000;

export async function login(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier") ?? "",
    password: formData.get("password") ?? "",
  });
  if (!parsed.success) return { ok: false, message: "login.invalid" };

  const raw = parsed.data.identifier.trim();
  const isEmail = raw.includes("@");
  const identifier = isEmail ? raw.toLowerCase() : normalizeMobile(raw);
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  const byId = rateLimit(`login:id:${identifier ?? raw}`, 5, WINDOW_MS);
  const byIp = rateLimit(`login:ip:${ip}`, 30, WINDOW_MS);
  if (!byId.ok || !byIp.ok) {
    const minutes = Math.ceil(Math.max(byId.retryAfterMs, byIp.retryAfterMs) / 60000);
    return { ok: false, message: `login.rateLimited:${minutes}` };
  }

  const user = identifier
    ? await prisma.user.findFirst({
        where: { ...(isEmail ? { email: identifier } : { phone: identifier }), active: true, deletedAt: { isSet: false } },
      })
    : null;

  const valid = await verifyPassword(parsed.data.password, user?.passwordHash);
  if (!user || !valid) {
    if (user) await audit(null, { action: "login_failed", entity: "User", entityId: user.id, clientId: user.clientId });
    return { ok: false, message: "login.invalid" };
  }

  const institutionId =
    user.institutionId ??
    (await prisma.institution.findFirst({
      where: { clientId: user.clientId, deletedAt: { isSet: false } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }))?.id ??
    null;

  const session = {
    userId: user.id,
    clientId: user.clientId,
    role: user.role,
    institutionId,
    canManageClients: user.canManageClients,
    name: user.name,
  };
  await startSession(session);
  (await cookies()).set(LOCALE_COOKIE, user.locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit(session, { action: "login", entity: "User", entityId: user.id });
  resetRateLimit(`login:id:${identifier}`);

  redirect("/");
}
