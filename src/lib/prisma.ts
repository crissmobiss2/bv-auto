import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { ROOT_MODELS, createdIds, currentShopId, rememberCreated, scopeArgs, scopeFilter, stampUnscopedCreate } from "@/lib/tenant";

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
  const base = new PrismaClient({
    adapter: createAdapter(),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  const delegate = (model: string) =>
    (scoped as unknown as Record<string, { count: (a: object) => Promise<number> }>)[model[0].toLowerCase() + model.slice(1)];
  const ownerShop = async (model: string, id: string) => {
    const d = (base as unknown as Record<string, { findUnique: (a: object) => Promise<{ shopId: string | null } | null> }>)[
      model[0].toLowerCase() + model.slice(1)
    ];
    return (await d.findUnique({ where: { id }, select: { shopId: true } }))?.shopId ?? null;
  };
  // Until public pages carry a shop, unowned creates go to the oldest active shop.
  let fallback: { id: string | null; at: number } | null = null;
  const fallbackShop = async () => {
    if (!fallback || Date.now() - fallback.at > 60_000) {
      const shop = await base.shop.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
      fallback = { id: shop?.id ?? null, at: Date.now() };
    }
    return fallback.id;
  };
  const scoped = base.$extends({
    name: "shop-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const shopId = currentShopId();
          if (!shopId) {
            if (!ROOT_MODELS.has(model) || !["create", "createMany", "createManyAndReturn", "upsert"].includes(operation)) return query(args);
            const a = { ...(args as Record<string, unknown>) };
            const key = operation === "upsert" ? "create" : "data";
            const stamp = (d: unknown) => stampUnscopedCreate(model, d as Record<string, unknown>, ownerShop, fallbackShop);
            a[key] = Array.isArray(a[key]) ? await Promise.all((a[key] as unknown[]).map(stamp)) : await stamp(a[key]);
            return query(a as typeof args);
          }
          if (!scopeFilter(model, shopId)) return query(args);
          const next = await scopeArgs(model, operation, (args ?? {}) as Record<string, unknown>, shopId,
            (target, id) => delegate(target).count({ where: { id } }), createdIds());
          const result = await query(next as typeof args);
          if (operation === "create" || operation === "upsert") rememberCreated(result);
          return result;
        },
      },
    },
  });
  // A query-only extension keeps the client's shape, so expose it with the plain PrismaClient type.
  return scoped as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
