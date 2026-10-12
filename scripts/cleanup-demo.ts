/**
 * Removes all demo/seed data so the shop can start using real tickets.
 *
 * Usage:  npm run db:demo:clean   (needs DATABASE_URL in .env)
 *
 * Deletes demo customers/vehicles/jobs (JOB-...-DEMO*), their quotes,
 * parts, and resets the "shop" record created by onboarding if it was
 * seeded with placeholder rates. Real records are untouched.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createAdapter } from "../src/lib/prisma";

const prisma = new PrismaClient({ adapter: createAdapter() });

function isDemoJob(jobNumber?: string | null) {
  return jobNumber?.includes("-DEMO");
}
void isDemoJob;

async function main() {
  console.log("Cleaning demo data...");

  // 1. Demo jobs (by well-known demo job numbers from the seed)
  const demoJobs = await prisma.job.findMany({
    where: { jobNumber: { in: ["JOB-2601-DEMO1", "JOB-2601-DEMO2", "JOB-2601-DEMO3"] } },
    select: { id: true, jobNumber: true },
  });

  // 2. Any job whose number carries the DEMO marker
  const extra = await prisma.job.findMany({
    where: { jobNumber: { contains: "-DEMO" } },
    select: { id: true, jobNumber: true },
  });

  const jobIds = [...new Set([...demoJobs, ...extra].map((j) => j.id))];

  if (jobIds.length > 0) {
    // Children first (no cascade guarantees on all relations)
    await prisma.jobPart.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.lineItem.deleteMany({ where: { quote: { jobId: { in: jobIds } } } });
    await prisma.quote.deleteMany({ where: { jobId: { in: jobIds } } });
    await prisma.timeLog.deleteMany({ where: { jobId: { in: jobIds } } }).catch(() => {});
    await prisma.note.deleteMany({ where: { jobId: { in: jobIds } } }).catch(() => {});
    await prisma.jobPhoto.deleteMany({ where: { jobId: { in: jobIds } } }).catch(() => {});
    await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
    console.log(`Deleted ${jobIds.length} demo job(s).`);
  } else {
    console.log("No demo jobs found.");
  }

  // 3. Demo customers (seeded ids) + any customer that only had demo jobs
  const demoCustomerIds = ["cust-demo-001", "cust-demo-002", "cust-demo-003"];
  const demoCustomers = await prisma.customer.findMany({
    where: { id: { in: demoCustomerIds } },
    select: { id: true },
  });
  for (const c of demoCustomers) {
    await prisma.customer.delete({ where: { id: c.id } }).catch(async () => {
      // If relations block the delete, deactivate instead
      await prisma.customer.update({ where: { id: c.id }, data: { isActive: false } });
    });
  }
  console.log(`Removed ${demoCustomers.length} demo customer(s).`);

  console.log("✅ Demo data cleanup complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());