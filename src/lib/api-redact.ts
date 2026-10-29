// Credentials that must never leave the server in an API response.
// Keep this narrow: some routes legitimately return one-time secrets such as
// the TOTP setup secret under a different key, and broad /token|secret/ rules
// would break them.
const NEVER_RETURN = new Set([
  "portalToken",
  "passwordHash",
  "totpSecret",
  "resetTokenHash",
  "verificationToken",
]);

/**
 * Recursively removes server-only credentials from a response payload.
 * Dates, Prisma Decimal values, Buffers and other class instances are left
 * intact so NextResponse can serialize them normally.
 */
export function redactApiPayload<T>(value: T, depth = 0): T {
  if (value === null || typeof value !== "object") return value;
  if (depth > 20) return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactApiPayload(item, depth + 1)) as T;
  }

  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (NEVER_RETURN.has(key)) continue;
    out[key] = redactApiPayload(item, depth + 1);
  }
  return out as T;
}
