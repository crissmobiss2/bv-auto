import { fromZonedTime, toZonedTime } from "date-fns-tz";

/**
 * All "today", "this week" and "this month" queries must use the shop's local
 * calendar, not the server's. Vercel runs in UTC, which is 7-8 hours ahead of
 * California and makes evening jobs disappear from "today".
 */
export const SHOP_TIMEZONE =
  process.env.SHOP_TIMEZONE || process.env.NEXT_PUBLIC_SHOP_TIMEZONE || "America/Los_Angeles";

/** A date-only value ("2026-10-30") means that calendar day in the shop, not midnight UTC. */
export function parseShopDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? fromZonedTime(`${value}T00:00:00`, SHOP_TIMEZONE)
    : new Date(value);
}

function zonedParts(date: Date) {
  return toZonedTime(date, SHOP_TIMEZONE);
}

export function shopDayStart(date = new Date()): Date {
  const z = zonedParts(date);
  return fromZonedTime(
    new Date(z.getFullYear(), z.getMonth(), z.getDate(), 0, 0, 0, 0),
    SHOP_TIMEZONE,
  );
}

export function shopDayEnd(date = new Date()): Date {
  const z = zonedParts(date);
  return fromZonedTime(
    new Date(z.getFullYear(), z.getMonth(), z.getDate() + 1, 0, 0, 0, 0),
    SHOP_TIMEZONE,
  );
}

export function shopWeekStart(date = new Date()): Date {
  const z = zonedParts(date);
  return fromZonedTime(
    new Date(z.getFullYear(), z.getMonth(), z.getDate() - z.getDay(), 0, 0, 0, 0),
    SHOP_TIMEZONE,
  );
}

export function shopMonthStart(date = new Date()): Date {
  const z = zonedParts(date);
  return fromZonedTime(
    new Date(z.getFullYear(), z.getMonth(), 1, 0, 0, 0, 0),
    SHOP_TIMEZONE,
  );
}
