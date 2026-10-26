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
    select: { name: true, phone: true, email: true },
  });
}

export async function getShopPhone(): Promise<string | null> {
  const shop = await getDefaultShop().catch(() => null);
  // Strip anything that isn't a phone character so the value is safe to
  // interpolate into generated HTML/SMS.
  return shop?.phone?.replace(/[^0-9+().\-\sx]/g, "") || null;
}
