/**
 * B&V Mobile Mechanic's sales tax rule: tax applies to parts only.
 * Labor and other service lines are not taxable.
 */
export const DEFAULT_TAX_RATE_PERCENT = 10.5;

export function isTaxableLineItem(type?: string | null) {
  return type === "PART";
}

/**
 * Shop.taxRate is stored as a fraction (0.105). Older seeds wrote 8.25 and a
 * migration-created placeholder shop used 0, so normalize those known legacy
 * values to the shop's actual 10.5% rate.
 */
export function shopTaxRatePercent(stored: unknown) {
  const value = Number(stored);
  if (!Number.isFinite(value) || value === 0 || value === 0.0825 || value === 8.25) {
    return DEFAULT_TAX_RATE_PERCENT;
  }
  return value > 1 ? value : value * 100;
}

export function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function calculateSalesTax(
  lineItems: { type?: string | null; total: unknown }[],
  taxRatePercent: number,
) {
  const taxableAmount = roundMoney(
    lineItems
      .filter((item) => isTaxableLineItem(item.type))
      .reduce((sum, item) => sum + (Number(item.total) || 0), 0),
  );
  const taxAmount = roundMoney(taxableAmount * ((Number(taxRatePercent) || 0) / 100));
  return { taxableAmount, taxAmount };
}
