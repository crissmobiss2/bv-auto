import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_MS = 30 * 60 * 1000;

function secret() {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
}

function sign(invoiceId: string, expiresAt: number) {
  return createHmac("sha256", secret()).update(`${invoiceId}.${expiresAt}`).digest("base64url");
}

/** A short-lived, read-only link so the PDF can open in the phone's browser. */
export function createInvoicePdfToken(invoiceId: string) {
  if (!secret()) return "";
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  return `${expiresAt}.${sign(invoiceId, expiresAt)}`;
}

export function verifyInvoicePdfToken(invoiceId: string, token: string | null | undefined) {
  if (!secret() || !token) return false;
  const [expiresRaw, provided] = token.split(".");
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now() || !provided) return false;
  const expected = sign(invoiceId, expiresAt);
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
