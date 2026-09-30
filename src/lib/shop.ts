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
  return shop?.phone || null;
}
