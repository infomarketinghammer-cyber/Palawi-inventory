import { Prisma } from "@prisma/client";

/** True when the error is a unique-constraint violation (optionally on a specific field). */
export function isUniqueViolation(e: unknown, field?: string): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") return false;
  if (!field) return true;
  const target = e.meta?.target;
  return Array.isArray(target) ? target.includes(field) : String(target ?? "").includes(field);
}
