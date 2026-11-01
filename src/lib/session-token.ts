import { SignJWT, jwtVerify } from "jose";

// Session token helpers. Edge-safe (used by middleware), so no Node-only imports here.

export const SESSION_COOKIE = "palawi_session";
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12 hours

export type Role = "STORE_USER" | "ADMIN";

export type Session = {
  userId: string;
  clientId: string;
  role: Role;
  /** Active institution. Null only when the client has none yet. */
  institutionId: string | null;
  canManageClients: boolean;
  name: string;
};

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters");
  return new TextEncoder().encode(s);
}

export async function signSession(session: Session): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: String(payload.userId),
      clientId: String(payload.clientId),
      role: payload.role === "ADMIN" ? "ADMIN" : "STORE_USER",
      institutionId: payload.institutionId ? String(payload.institutionId) : null,
      canManageClients: payload.canManageClients === true,
      name: String(payload.name ?? ""),
    };
  } catch {
    return null;
  }
}
