import { requireAuth, apiSuccess } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const [shopCount, userCount, customerCount, serviceCount] = await Promise.all([
    prisma.shop.count(),
    prisma.user.count({ where: { role: "TECHNICIAN" } }),
    prisma.customer.count(),
    prisma.cannedService.count(),
  ]);

  const completed = {
    shop: shopCount > 0,
    technician: userCount > 0,
    services: serviceCount > 0,
    customer: customerCount > 0,
  };

  const done = Object.values(completed).every(Boolean);

  return apiSuccess({ completed, done });
}
