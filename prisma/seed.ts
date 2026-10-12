import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createAdapter } from "../src/lib/prisma";

const prisma = new PrismaClient({ adapter: createAdapter() });

async function main() {
  console.log("Seeding B&V Mobile Auto database...");

  // Create users
  const adminHash = await bcrypt.hash("admin123", 12);

  await prisma.user.upsert({
    where: { email: "admin@bvauto.com" },
    update: {},
    create: {
      name: "Brandon V.",
      email: "admin@bvauto.com",
      passwordHash: adminHash,
      role: UserRole.ADMIN,
      phone: "5550001000",
    },
  });

  console.log("Users created.");

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
        name: "B&V Mobile Auto",
        phone: "5550001000",
        email: "service@bvauto.com",
        address: "Houston, TX",
        taxRate: 8.25,
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