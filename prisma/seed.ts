import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createAdapter } from "../src/lib/prisma";

const prisma = new PrismaClient({ adapter: createAdapter() });

async function main() {
  console.log("Seeding B&V Mobile Mechanic database...");

  // Every staff account needs a shop; API requests are scoped to it.
  let shop = await prisma.shop.findFirst({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
  if (!shop) {
    shop = await prisma.shop.create({
      data: {
        name: "B&V Mobile Mechanic",
        slug: "bv-mobile-mechanic",
        email: "service@bvauto.com",
        city: "Houston",
        state: "TX",
        taxRate: 0.105,
        laborRate: 105,
        isDefault: true,
      },
    });
  } else {
    // Repair the placeholder shop created by an older migration/seed.
    const updates: Record<string, unknown> = {};
    if (shop.name === "My Shop" || shop.name === "B&V Mobile Auto") {
      updates.name = "B&V Mobile Mechanic";
    }
    if ([0, 0.0825, 8.25].includes(Number(shop.taxRate))) {
      updates.taxRate = 0.105;
    }
    if (Number(shop.laborRate) === 0) {
      updates.laborRate = 105;
    }
    if (Object.keys(updates).length > 0) {
      shop = await prisma.shop.update({ where: { id: shop.id }, data: updates });
    }
  }

  // Create users
  const adminHash = await bcrypt.hash("admin123", 12);
  const techHash = await bcrypt.hash("tech123", 12);

  await prisma.user.upsert({
    where: { email: "admin@bvauto.com" },
    update: { shopId: shop.id },
    create: {
      name: "Brandon V.",
      email: "admin@bvauto.com",
      passwordHash: adminHash,
      role: UserRole.ADMIN,
      phone: "",
      shopId: shop.id,
    },
  });

  const tech = await prisma.user.upsert({
    where: { email: "marcus@bvauto.com" },
    update: { shopId: shop.id },
    create: {
      name: "Marcus Tech",
      email: "marcus@bvauto.com",
      passwordHash: techHash,
      role: UserRole.TECHNICIAN,
      phone: "",
      shopId: shop.id,
    },
  });

  await prisma.payrollRate.upsert({
    where: { userId: tech.id },
    update: {},
    create: { userId: tech.id, rateType: "HOURLY", hourlyRate: 30 },
  });

  console.log("Shop and users created.");

  // Create real parts vendors
  await prisma.partsVendor.upsert({
    where: { id: "vendor-autozone" },
    update: {},
    create: {
      id: "vendor-autozone",
      name: "AutoZone",
      contactName: "Parts Counter",
      phone: "5551234567",
      email: "parts@autozone.local",
      city: "Houston",
      state: "TX",
      accountNum: "AZ-78234",
    },
  });

  await prisma.partsVendor.upsert({
    where: { id: "vendor-oreilly" },
    update: {},
    create: {
      id: "vendor-oreilly",
      name: "O'Reilly Auto Parts",
      contactName: "Will S.",
      phone: "5552345678",
      city: "Houston",
      state: "TX",
      accountNum: "OR-55123",
    },
  });

  console.log("Vendors created.");

  // Settings
  await prisma.settings.upsert({
    where: { key: "business" },
    update: {},
    create: {
      key: "business",
      value: {
        name: "B&V Mobile Mechanic",
        phone: "",
        email: "service@bvauto.com",
        address: "Houston, TX",
        taxRate: 10.5,
        laborRate: 85,
      },
      description: "Business configuration",
    },
  });

  console.log("✅ Seed completed successfully!");
  console.log("Login: admin@bvauto.com / admin123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());