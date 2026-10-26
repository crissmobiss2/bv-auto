// DATA-010: audit rows must never hold credentials, and are only kept for a bounded time.

const SENSITIVE_KEY = /pass(word)?|hash|token|secret|api[_-]?key|^otp|totp|ssn|card(number)?|cvv|signature(data|url)?$/i;

const retentionEnv = Number(process.env.AUDIT_RETENTION_DAYS);
export const AUDIT_RETENTION_DAYS =
  process.env.AUDIT_RETENTION_DAYS && Number.isFinite(retentionEnv) ? Math.max(30, retentionEnv) : 365;

export function redactAuditPayload<T>(value: T, depth = 0): T {
  if (value === null || typeof value !== "object") return value;
  if (depth > 20) return "[truncated]" as T;
  if (Array.isArray(value)) return value.map((v) => redactAuditPayload(v, depth + 1)) as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY.test(k) && v != null ? "[redacted]" : redactAuditPayload(v, depth + 1);
  }
  return out as T;
}

const BOT_UA =
  /bot|crawl|spider|preview|facebookexternalhit|slack|whatsapp|telegram|discord|skype|linkedin|embedly|curl|wget|python-requests|httpclient|headless|okhttp|go-http-client|scanner|proofpoint|mimecast|barracuda|safelinks/i;

/** PORT-012: link previewers and mail scanners fetch links without a human clicking them. */
export function looksLikeBot(userAgent: string | null | undefined, method = "GET"): boolean {
  if (method !== "GET") return true;
  if (!userAgent) return true;
  return BOT_UA.test(userAgent);
}
