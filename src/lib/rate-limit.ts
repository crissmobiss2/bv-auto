// In-memory sliding-window rate limiter.
// Works per-instance on Vercel serverless — good enough for soft launch.
// Upgrade to @upstash/ratelimit + Vercel KV before scaling past ~50 concurrent users.

interface Record {
  count: number;
  resetAt: number;
}

const store = new Map<string, Record>();

// Clean up expired entries periodically (runs at most once per minute per instance)
let lastCleanup = 0;
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, rec] of store) {
    if (rec.resetAt < now) store.delete(key);
  }
}

/**
 * Returns true if the request is allowed, false if rate-limited.
 * @param key     Unique identifier (e.g. `ip:${ip}:ai`)
 * @param limit   Max requests per window
 * @param windowMs Window size in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
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

/** Extracts the best available IP from a Next.js request. */
export function getIP(request: Request): string {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
