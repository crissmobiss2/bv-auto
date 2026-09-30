import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export function createAdapter() {
  const url = process.env.DATABASE_URL ?? "";
  // Neon's serverless driver only works against *.neon.tech endpoints;
  // use the standard pg driver for local/other Postgres databases.
  if (url.includes("neon.tech") || url.includes("neon.build")) {
    return new PrismaNeon({ connectionString: url });
  }
  return new PrismaPg({ connectionString: url });
}

function createPrismaClient() {
  return new PrismaClient({
    adapter: createAdapter(),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
