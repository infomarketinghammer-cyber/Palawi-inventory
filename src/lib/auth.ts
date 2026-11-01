import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession, type Session } from "./session-token";

export type { Session };

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  // Deactivated or deleted users lose access immediately, not when the token expires.
  const user = await prisma.user.findFirst({
    where: { id: session.userId, active: true, deletedAt: { isSet: false } },
    select: { id: true },
  });
  return user ? session : null;
}

export async function startSession(session: Session) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function endSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function requireUser(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireUser();
  if (session.role !== "ADMIN") redirect("/?denied=1");
  return session;
}

export async function requireClientManager(): Promise<Session> {
  const session = await requireAdmin();
  if (!session.canManageClients) redirect("/?denied=1");
  return session;
}
