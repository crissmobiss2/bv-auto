import { prisma } from "@/lib/prisma";

// AUTH-010 / DATA-001 (option B): records carry no shopId, so a second shop would see
// every other shop's customers and invoices. Until real tenant scoping exists, the app
// runs exactly one shop.
export const SINGLE_SHOP_LOCK = 724_002;
export const SINGLE_SHOP_MESSAGE =
  "This app runs a single shop. Edit the existing shop instead of adding another.";
export const ONLY_SHOP_MESSAGE = "The shop can't be deactivated: it is the only shop.";

export async function getDefaultShop() {
  return prisma.shop.findFirst({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { name: true, phone: true, email: true, logoUrl: true, city: true, state: true },
  });
}

export const DEFAULT_SHOP_NAME = process.env.DEFAULT_SHOP_NAME || "B&V Mobile Mechanic";

// Names written by older seeds/migrations. Existing rows may not have the
// latest branding migration yet, so keep customer-facing documents correct.
const LEGACY_SHOP_NAMES = new Set(["B&V Mobile Auto", "My Shop"]);

export function shopDisplayName(name?: string | null) {
  const trimmed = name?.trim();
  return trimmed && !LEGACY_SHOP_NAMES.has(trimmed) ? trimmed : DEFAULT_SHOP_NAME;
}

/** Customer-facing identity of the shop: used in texts, emails, PDFs and public pages. */
export async function getBranding() {
  const shop = await getDefaultShop().catch(() => null);
  return {
    name: shopDisplayName(shop?.name),
    phone: shop?.phone?.replace(/[^0-9+().\-\sx]/g, "") || null,
    email: shop?.email || null,
    logoUrl: shop?.logoUrl || null,
    location: [shop?.city, shop?.state].filter(Boolean).join(", ") || null,
  };
}

export async function getShopPhone(): Promise<string | null> {
  const shop = await getDefaultShop().catch(() => null);
  // Strip anything that isn't a phone character so the value is safe to
  // interpolate into generated HTML/SMS.
  return shop?.phone?.replace(/[^0-9+().\-\sx]/g, "") || null;
}
