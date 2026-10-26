import { currentShopId } from "@/lib/tenant";
// CRM-008: duplicate-customer detection and merge.
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export type DuplicateCustomer = { id: string; firstName: string; lastName: string; phone: string; email: string | null };

export const phoneKey = (phone: string | null | undefined) => (phone ?? "").replace(/\D/g, "").slice(-10);

/** Active customers sharing the last 10 phone digits or the email (case-insensitive). */
export async function findDuplicateCustomers(
  db: Db,
  { phone, email, excludeId }: { phone?: string | null; email?: string | null; excludeId?: string },
): Promise<DuplicateCustomer[]> {
  const p = phoneKey(phone);
  const e = (email ?? "").trim().toLowerCase();
  if (p.length < 7 && !e) return [];
  const shopId = currentShopId();
  return db.$queryRaw<DuplicateCustomer[]>`
    SELECT "id", "firstName", "lastName", "phone", "email" FROM "Customer"
    WHERE "isActive" = true
      AND (${shopId}::text IS NULL OR "shopId" = ${shopId})
      AND "id" <> ${excludeId ?? ""}
      AND (
        (${p.length >= 7} AND right(regexp_replace(coalesce("phone", ''), '\\D', '', 'g'), 10) = ${p})
        OR (${e !== ""} AND lower("email") = ${e})
      )
    ORDER BY "createdAt" ASC
    LIMIT 5`;
}

const FILL_FIELDS = ["company", "email", "altPhone", "address", "city", "state", "zip", "referredBy", "taxExemptId"] as const;

type MergeCustomer = {
  id: string;
  phone?: string | null;
  tags: string[];
  notes: string | null;
  smsOptOut: boolean;
  smsOptOutAt: Date | null;
  smsConsentAt?: Date | null;
  marketingOptOut: boolean;
  taxExempt: boolean;
} & Partial<Record<(typeof FILL_FIELDS)[number], string | null>>;

/** Field values for the surviving customer: keep target values, fill blanks from source, keep any opt-out. */
export function mergedFields(target: MergeCustomer, source: MergeCustomer) {
  const data: Record<string, unknown> = {};
  for (const f of FILL_FIELDS) if (!target[f] && source[f]) data[f] = source[f];
  data.tags = Array.from(new Set([...(target.tags ?? []), ...(source.tags ?? [])]));
  if (source.notes) data.notes = target.notes ? `${target.notes}\n\n${source.notes}` : source.notes;
  if (source.smsOptOut && !target.smsOptOut) {
    data.smsOptOut = true;
    data.smsOptOutAt = source.smsOptOutAt ?? new Date();
  }
  // Consent belongs to a phone number, so it only carries over when both records share the number.
  const digits = (p?: string | null) => (p ?? "").replace(/\D/g, "").slice(-10);
  if (source.smsConsentAt && !target.smsConsentAt && digits(source.phone) && digits(source.phone) === digits(target.phone)) {
    data.smsConsentAt = source.smsConsentAt;
  }
  if (source.marketingOptOut) data.marketingOptOut = true;
  if (source.taxExempt) data.taxExempt = true;
  return data;
}

/** Moves every record from source to target, then deactivates source. Call inside a transaction. */
export async function mergeCustomers(tx: Prisma.TransactionClient, target: MergeCustomer, source: MergeCustomer) {
  const move = { where: { customerId: source.id }, data: { customerId: target.id } };
  const moved = await Promise.all([
    tx.vehicle.updateMany(move),
    tx.job.updateMany(move),
    tx.quote.updateMany(move),
    tx.invoice.updateMany(move),
    tx.note.updateMany(move),
    tx.communication.updateMany(move),
    tx.followUp.updateMany(move),
    tx.serviceRequest.updateMany(move),
    tx.smsMessage.updateMany(move),
    tx.reviewRequest.updateMany(move),
    tx.declinedService.updateMany(move),
    tx.warranty.updateMany(move),
    tx.commEnrollment.updateMany(move),
    tx.user.updateMany(move),
  ]);
  await tx.customer.update({ where: { id: target.id }, data: mergedFields(target, source) });
  await tx.customer.update({
    where: { id: source.id },
    data: { isActive: false, portalToken: null, notes: `Merged into customer ${target.id} on ${new Date().toISOString().slice(0, 10)}.` },
  });
  return moved.reduce((n, r) => n + r.count, 0);
}
