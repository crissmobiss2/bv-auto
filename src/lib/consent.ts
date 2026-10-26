import { prisma } from "@/lib/prisma";

export type SmsKeyword = "STOP" | "START" | "HELP";

const STOP_WORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "OPTOUT", "REVOKE"]);
const START_WORDS = new Set(["START", "UNSTOP", "YES"]);
const HELP_WORDS = new Set(["HELP", "INFO"]);

/** Carrier-standard opt-out keywords; only a message that is just the keyword counts. */
export function parseSmsKeyword(body: string): SmsKeyword | null {
  const word = body.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (STOP_WORDS.has(word)) return "STOP";
  if (START_WORDS.has(word)) return "START";
  if (HELP_WORDS.has(word)) return "HELP";
  return null;
}

/** The formats a phone number may be stored in (raw, +1XXXXXXXXXX, 10 digits). */
export function phoneVariants(raw: string): string[] {
  const digits = raw.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return Array.from(new Set([raw, `+${digits}`, digits, ten, `+1${ten}`].filter(Boolean)));
}

function phoneWhere(raw: string) {
  const v = phoneVariants(raw);
  return { OR: [{ phone: { in: v } }, { altPhone: { in: v } }] };
}

export async function setSmsOptOut(phone: string, optOut: boolean) {
  return prisma.customer.updateMany({
    where: phoneWhere(phone),
    data: { smsOptOut: optOut, smsOptOutAt: optOut ? new Date() : null },
  });
}

export class SmsOptedOutError extends Error {
  constructor() {
    super("This customer replied STOP and has opted out of text messages");
    this.name = "SmsOptedOutError";
  }
}

/** Throws when any customer on this number has opted out of SMS. */
export async function assertSmsAllowed(phone: string) {
  const blocked = await prisma.customer.findFirst({
    where: { ...phoneWhere(phone), smsOptOut: true },
    select: { id: true },
  });
  if (blocked) throw new SmsOptedOutError();
}

/** Prisma filter for customers who may receive marketing texts. */
export const marketableSms = { isActive: true, smsOptOut: false, marketingOptOut: false, smsConsentAt: { not: null } } as const;
