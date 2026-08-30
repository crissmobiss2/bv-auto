/**
 * ONE-TIME multi-tenancy backfill.
 *
 * The app now scopes almost every query by `shopId`. Existing rows were created
 * before that column existed, so after you apply the schema change
 * (`npm run db:push`) their `shopId` is NULL and scoped queries return nothing.
 *
 * This script:
 *   1. ensures a default Shop exists, and
 *   2. assigns every existing tenant row (and every user) to it.
 *
 * Run ONCE against each environment right after `db:push`, BEFORE using the app:
 *     npx tsx prisma/backfill-shops.ts
 *
 * It is idempotent — only rows with a NULL shopId are touched, so re-running is safe.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1) Ensure a default shop.
  let shop =
    (await prisma.shop.findFirst({ where: { isDefault: true } })) ??
    (await prisma.shop.findFirst());

  if (!shop) {
    shop = await prisma.shop.create({
      data: { name: "B&V Mobile Auto", isDefault: true, taxRate: 0.0825, laborRate: 105, isActive: true },
    });
    console.log(`Created default shop ${shop.id} (${shop.name})`);
  } else {
    console.log(`Using existing shop ${shop.id} (${shop.name})`);
  }
  const shopId = shop.id;

  // 2) Backfill every tenant-scoped table + users. Order doesn't matter (all nullable FKs).
  const models = [
    "user", "customer", "vehicle", "job", "quote", "invoice",
    "partsVendor", "inventoryItem", "fleetAccount",
    "marketingCampaign", "cannedService", "serviceRequest",
  ] as const;

  for (const m of models) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = (prisma as any)[m];
    const res = await model.updateMany({ where: { shopId: null }, data: { shopId } });
    console.log(`  ${m}: assigned ${res.count} row(s)`);
  }

  console.log("Backfill complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
