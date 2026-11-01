import "server-only";
import { prisma } from "./db";

/** Login identifiers are unique across the whole platform (checked here; MongoDB can't index optional uniques). */
export async function identifierTaken(email?: string | null, phone?: string | null): Promise<boolean> {
  const or = [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])];
  if (!or.length) return false;
  return Boolean(await prisma.user.findFirst({ where: { OR: or, deletedAt: { isSet: false } }, select: { id: true } }));
}
