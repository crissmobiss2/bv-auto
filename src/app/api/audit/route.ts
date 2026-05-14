import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, apiSuccess } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const { error } = await requireRole(["ADMIN", "DISPATCHER"]);
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const entity = searchParams.get("entity") || "";
  const userId = searchParams.get("userId") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const exportCsv = searchParams.get("export") === "csv";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (entity) where.entity = entity;
  if (userId) where.userId = userId;

  if (startDate || endDate) {
    const dateFilter: Record<string, Date> = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }
    where.createdAt = dateFilter;
  }

  if (exportCsv) {
    // Fetch all matching rows (no pagination) for CSV export
    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });

    const escapeCsv = (val: string | null | undefined) => {
      if (val == null) return "";
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = ["timestamp", "user", "action", "entity", "entityId", "notes"];
    const rows = logs.map((log) => [
      escapeCsv(log.createdAt.toISOString()),
      escapeCsv(log.user ? `${log.user.name} <${log.user.email}>` : "System"),
      escapeCsv(log.action),
      escapeCsv(log.entity),
      escapeCsv(log.entityId),
      escapeCsv(log.notes ?? ""),
    ]);

    const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
    const now = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="audit-log-${now}.csv"`,
      },
    });
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return apiSuccess({ logs, total, page, limit });
}
