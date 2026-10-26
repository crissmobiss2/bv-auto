import { prisma } from "@/lib/prisma";

// Durable fixed-window rate limiter backed by the `RateLimit` table, so limits
// hold across serverless instances and restarts. If the database is
// unreachable it falls back to a per-instance in-memory window.

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

let lastCleanup = 0;
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, rec] of store) {
    if (rec.resetAt < now) store.delete(key);
  }
}

/** Per-instance limiter; used directly only as the database fallback. */
export function rateLimitLocal(key: string, limit: number, windowMs: number): boolean {
  cleanup();
  const now = Date.now();
  const rec = store.get(key);

  if (!rec || rec.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (rec.count >= limit) return false;
  rec.count++;
  return true;
}

/**
 * Resolves true if the request is allowed, false if rate-limited.
 * @param key      Unique identifier (e.g. `ai:${ip}`)
 * @param limit    Max requests per window
 * @param windowMs Window size in milliseconds
 * @param opts.durable Refuse when the shared counter is unavailable instead of counting per instance
 */
export async function rateLimit(key: string, limit: number, windowMs: number, opts: { durable?: boolean } = {}): Promise<boolean> {
  // Refused calls stop counting at limit+1, so a shop that upgrades mid-window gets its new allowance.
  const cap = Number.isFinite(limit) ? limit + 1 : 2_147_483_647;
  try {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt")
      VALUES (${key}, 1, now() + make_interval(secs => ${windowMs / 1000}))
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."resetAt" < now() THEN 1 ELSE LEAST("RateLimit"."count" + 1, ${cap}) END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" < now() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
      RETURNING "count"`;
    const count = Number(rows?.[0]?.count);
    if (!Number.isFinite(count)) throw new Error("rate limit row missing");
    if (Math.random() < 0.01) {
      void prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "resetAt" < now()`.catch(() => {});
    }
    return count <= limit;
  } catch {
    // A per-instance count can't enforce a shop-wide allowance, so durable callers refuse instead.
    if (opts.durable) return false;
    return rateLimitLocal(key, limit, windowMs);
  }
}

/** Extracts the best available IP from a Next.js request. */
export function getIP(request: Request): string {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
