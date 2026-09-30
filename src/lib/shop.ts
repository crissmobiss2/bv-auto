import { prisma } from "@/lib/prisma";

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
