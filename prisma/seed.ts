import { PrismaClient, UserRole } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding B&V Mobile Auto database...");

  // Create users
  const adminHash = await bcrypt.hash("admin123", 12);
  const techHash = await bcrypt.hash("tech123", 12);

  const admin = await prisma.user.upsert({
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

  const tech = await prisma.user.upsert({
    where: { email: "tech@bvauto.com" },
    update: {},
    create: {
      name: "Marcus T.",
      email: "tech@bvauto.com",
      passwordHash: techHash,
      role: UserRole.TECHNICIAN,
      phone: "5550001001",
    },
  });

  const dispatcher = await prisma.user.upsert({
    where: { email: "dispatch@bvauto.com" },
    update: {},
    create: {
      name: "Sarah M.",
      email: "dispatch@bvauto.com",
      passwordHash: await bcrypt.hash("dispatch123", 12),
      role: UserRole.DISPATCHER,
      phone: "5550001002",
    },
  });

  console.log("Users created.");

  // Create vendors
  const vendor1 = await prisma.partsVendor.upsert({
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

  const vendor2 = await prisma.partsVendor.upsert({
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

  // Create demo customers
  const customer1 = await prisma.customer.upsert({
    where: { id: "cust-demo-001" },
    update: {},
    create: {
      id: "cust-demo-001",
      firstName: "James",
      lastName: "Williams",
      email: "james.w@email.com",
      phone: "7135550101",
      address: "4521 Oak Street",
      city: "Houston",
      state: "TX",
      zip: "77002",
      leadSource: "REFERRAL",
    },
  });

  const customer2 = await prisma.customer.upsert({
    where: { id: "cust-demo-002" },
    update: {},
    create: {
      id: "cust-demo-002",
      firstName: "Maria",
      lastName: "Garcia",
      email: "mgarcia@email.com",
      phone: "7135550202",
      address: "1203 Westheimer Rd",
      city: "Houston",
      state: "TX",
      zip: "77006",
      leadSource: "GOOGLE",
    },
  });

  const customer3 = await prisma.customer.upsert({
    where: { id: "cust-demo-003" },
    update: {},
    create: {
      id: "cust-demo-003",
      firstName: "Robert",
      lastName: "Chen",
      phone: "7135550303",
      city: "Houston",
      state: "TX",
      leadSource: "PHONE",
      type: "INDIVIDUAL",
    },
  });

  console.log("Customers created.");

  // Create vehicles
  const vehicle1 = await prisma.vehicle.upsert({
    where: { id: "veh-demo-001" },
    update: {},
    create: {
      id: "veh-demo-001",
      customerId: customer1.id,
      year: 2019,
      make: "Toyota",
      model: "Camry",
      trim: "SE",
      color: "Silver",
      vin: "4T1BF1FK5KU123456",
      plate: "ABC1234",
      plateState: "TX",
      mileage: 62400,
      engine: "2.5L 4-Cyl",
      transmission: "Automatic",
    },
  });

  const vehicle2 = await prisma.vehicle.upsert({
    where: { id: "veh-demo-002" },
    update: {},
    create: {
      id: "veh-demo-002",
      customerId: customer2.id,
      year: 2021,
      make: "Ford",
      model: "F-150",
      trim: "XLT",
      color: "Blue",
      vin: "1FTFW1E53MFC12345",
      plate: "XYZ5678",
      plateState: "TX",
      mileage: 38100,
      engine: "5.0L V8",
    },
  });

  const vehicle3 = await prisma.vehicle.upsert({
    where: { id: "veh-demo-003" },
    update: {},
    create: {
      id: "veh-demo-003",
      customerId: customer3.id,
      year: 2017,
      make: "Honda",
      model: "Civic",
      color: "White",
      plate: "DEF9012",
      plateState: "TX",
      mileage: 89200,
    },
  });

  console.log("Vehicles created.");

  // Create demo jobs
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const job1 = await prisma.job.upsert({
    where: { jobNumber: "JOB-2601-DEMO1" },
    update: {},
    create: {
      jobNumber: "JOB-2601-DEMO1",
      customerId: customer1.id,
      vehicleId: vehicle1.id,
      technicianId: tech.id,
      createdById: admin.id,
      title: "Oil Change + Tire Rotation",
      description: "Full synthetic oil change and 4-tire rotation. Customer reported slight vibration at highway speeds.",
      serviceLocation: "4521 Oak Street, Houston TX 77002",
      scheduledAt: tomorrow,
      status: "SCHEDULED",
      mileageIn: 62400,
      estimatedHours: 1.5,
    },
  });

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 5);
  nextWeek.setHours(9, 0, 0, 0);

  const job2 = await prisma.job.upsert({
    where: { jobNumber: "JOB-2601-DEMO2" },
    update: {},
    create: {
      jobNumber: "JOB-2601-DEMO2",
      customerId: customer2.id,
      vehicleId: vehicle2.id,
      technicianId: tech.id,
      createdById: admin.id,
      title: "Brake Pad Replacement — Front",
      description: "Front brake pads worn to 2mm. Customer reports squealing. Inspect rotors.",
      serviceLocation: "1203 Westheimer Rd, Houston TX 77006",
      scheduledAt: nextWeek,
      status: "PENDING_APPROVAL",
      mileageIn: 38100,
      estimatedHours: 2,
    },
  });

  const job3 = await prisma.job.upsert({
    where: { jobNumber: "JOB-2601-DEMO3" },
    update: {},
    create: {
      jobNumber: "JOB-2601-DEMO3",
      customerId: customer3.id,
      vehicleId: vehicle3.id,
      createdById: admin.id,
      title: "Check Engine Light Diagnosis",
      description: "Check engine light on. P0420 catalyst efficiency code. Customer wants full diagnosis.",
      status: "ESTIMATE",
      estimatedHours: 1,
    },
  });

  console.log("Jobs created.");

  // Create a quote for job2
  await prisma.quote.upsert({
    where: { jobId: job2.id },
    update: {},
    create: {
      quoteNumber: "QT-2601-DEMO1",
      jobId: job2.id,
      customerId: customer2.id,
      createdById: admin.id,
      status: "SENT",
      title: "Front Brake Pad Replacement",
      taxRate: 8.25,
      subtotal: 285,
      taxAmount: 23.51,
      totalAmount: 308.51,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lineItems: {
        create: [
          {
            type: "PART",
            sortOrder: 1,
            description: "Front Brake Pad Set (OEM Quality)",
            partNumber: "D1583-8380",
            quantity: 1,
            unitPrice: 85,
            markup: 30,
            taxable: true,
            total: 110.50,
          },
          {
            type: "LABOR",
            sortOrder: 2,
            description: "Front Brake Pad Installation (2 hrs)",
            quantity: 2,
            unitPrice: 85,
            taxable: false,
            total: 170,
          },
          {
            type: "SHOP_SUPPLY",
            sortOrder: 3,
            description: "Brake Cleaner & Lubricant",
            quantity: 1,
            unitPrice: 4.50,
            taxable: true,
            total: 4.50,
          },
        ],
      },
    },
  });

  // Add a part to job1
  await prisma.jobPart.upsert({
    where: { id: "part-demo-001" },
    update: {},
    create: {
      id: "part-demo-001",
      jobId: job1.id,
      vendorId: vendor1.id,
      description: "Mobil 1 5W-30 Full Synthetic Oil Filter",
      partNumber: "M1-204A",
      quantity: 1,
      unitCost: 9.99,
      unitPrice: 14.99,
      totalCost: 9.99,
      totalPrice: 14.99,
      status: "RECEIVED",
    },
  });

  console.log("Quotes and parts created.");

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
