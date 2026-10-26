import { prisma } from "@/lib/prisma";

/** URL-safe key from a shop name, e.g. "B&V Mobile Auto" -> "b-v-mobile-auto". */
export function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "") || "shop";
}

export async function uniqueShopSlug(name: string) {
  const base = slugify(name);
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (!(await prisma.shop.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  throw new Error("Could not allocate a shop link");
}

/**
 * The shop a public page acts for. Called outside any signed-in shop context.
 * Links without ?shop= keep going to the original (oldest) shop so existing links still work.
 */
export async function resolvePublicShop(slug?: string | null) {
  if (slug) return prisma.shop.findFirst({ where: { slug, isActive: true }, select: { id: true } });
  return prisma.shop.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
}

export function countActiveShops() {
  return prisma.shop.count({ where: { isActive: true } });
}
