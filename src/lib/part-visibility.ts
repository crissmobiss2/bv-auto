// Shop-floor roles need part identity and status, not vendor cost or margin.
const HIDDEN_FROM_SHOP_FLOOR = new Set([
  "unitCost",
  "unitPrice",
  "markup",
  "totalCost",
  "totalPrice",
  "coreCharge",
  "creditAmount",
  "vendor",
]);

export function redactPartForShopFloor<T extends Record<string, unknown>>(part: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(part)) {
    if (!HIDDEN_FROM_SHOP_FLOOR.has(key)) out[key] = value;
  }
  return out as Partial<T>;
}
