// Fixed-window in-memory rate limiter. Good enough for a single server instance;
// swap for a shared store (e.g. Postgres or Redis) if the app is scaled horizontally.

const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterMs: number } {
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  entry.count++;
  if (entry.count > limit) return { ok: false, retryAfterMs: entry.resetAt - now };
  return { ok: true, retryAfterMs: 0 };
}

export function resetRateLimit(key: string) {
  hits.delete(key);
}
