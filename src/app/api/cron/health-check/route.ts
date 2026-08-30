import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { assertCron } from "@/lib/api-helpers";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = "B&V Auto Monitor <service@bvauto.com>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "crissmobiss@gmail.com";
const BASE_URL = process.env.NEXTAUTH_URL || "https://bv-auto.vercel.app";

export async function GET(req: NextRequest) {
  const unauthorized = assertCron(req);
  if (unauthorized) return unauthorized;

  const now = new Date();
  const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const ago7d  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // ── Gather all platform health data in parallel ────────────────────────────
  const [
    overdueInvoices,
    overdueJobs,
    unassignedJobs,
    stalledJobs,
    lowInventory,
    expiringWarranties,
    pendingServiceRequests,
    recentPayments,
    newCustomers,
    openJobCount,
    revenueToday,
    revenueWeek,
  ] = await Promise.all([
    // Invoices overdue
    prisma.invoice.findMany({
      where: { status: "OVERDUE" },
      select: {
        id: true, invoiceNumber: true, dueDate: true, totalAmount: true,
        job: { include: { customer: { select: { firstName: true, lastName: true, email: true } } } },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),

    // Jobs overdue (scheduled in past, not completed)
    prisma.job.findMany({
      where: {
        scheduledAt: { lt: now },
        status: { in: ["SCHEDULED", "APPROVED", "IN_PROGRESS"] },
      },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        technician: { select: { name: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 10,
    }),

    // Jobs with no technician assigned
    prisma.job.findMany({
      where: {
        technicianId: null,
        status: { in: ["APPROVED", "SCHEDULED"] },
      },
      include: { customer: { select: { firstName: true, lastName: true } } },
      take: 10,
    }),

    // Jobs stuck in PARTS_WAITING or IN_PROGRESS for > 7 days
    prisma.job.findMany({
      where: {
        status: { in: ["PARTS_WAITING", "IN_PROGRESS"] },
        updatedAt: { lt: ago7d },
      },
      include: {
        customer: { select: { firstName: true, lastName: true } },
        technician: { select: { name: true } },
      },
      take: 10,
    }),

    // Low inventory items
    prisma.inventoryItem.findMany({
      where: { reorderPoint: { gt: 0 } },
      select: { name: true, partNumber: true, quantityOnHand: true, reorderPoint: true },
    }).then(items => items.filter(i => i.quantityOnHand <= i.reorderPoint)),

    // Warranties expiring in next 30 days
    prisma.warranty.findMany({
      where: {
        expiryDate: { gte: now, lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
      },
      include: {
        job: { include: { customer: { select: { firstName: true, lastName: true } } } },
      },
      take: 10,
    }),

    // Pending service requests > 24h old
    prisma.serviceRequest.findMany({
      where: {
        status: "PENDING",
        createdAt: { lt: ago24h },
      },
      include: { customer: { select: { firstName: true, lastName: true } } },
      take: 10,
    }).catch(() => []),

    // Payments received in last 24h
    prisma.payment.aggregate({
      where: { receivedAt: { gte: ago24h } },
      _sum: { amount: true },
      _count: true,
    }),

    // New customers last 24h
    prisma.customer.count({ where: { createdAt: { gte: ago24h } } }),

    // Total open jobs
    prisma.job.count({
      where: { status: { in: ["ESTIMATE","PENDING_APPROVAL","APPROVED","SCHEDULED","IN_PROGRESS","PARTS_WAITING"] } },
    }),

    // Revenue today
    prisma.payment.aggregate({
      where: { receivedAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } },
      _sum: { amount: true },
    }),

    // Revenue this week
    prisma.payment.aggregate({
      where: { receivedAt: { gte: ago7d } },
      _sum: { amount: true },
    }),
  ]);

  const issues: string[] = [];
  if (overdueInvoices.length > 0)      issues.push(`${overdueInvoices.length} overdue invoice(s)`);
  if (overdueJobs.length > 0)          issues.push(`${overdueJobs.length} overdue job(s)`);
  if (unassignedJobs.length > 0)       issues.push(`${unassignedJobs.length} unassigned job(s)`);
  if (stalledJobs.length > 0)          issues.push(`${stalledJobs.length} stalled job(s) (7+ days)`);
  if (lowInventory.length > 0)         issues.push(`${lowInventory.length} low inventory item(s)`);
  if (pendingServiceRequests.length > 0) issues.push(`${pendingServiceRequests.length} pending service request(s)`);

  const hasIssues = issues.length > 0;

  // ── Build the email ────────────────────────────────────────────────────────
  const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  function section(title: string, color: string, rows: string) {
    return `
      <div style="margin-bottom:20px;">
        <h3 style="margin:0 0 8px;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${color};">${title}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">${rows}</table>
      </div>`;
  }

  function row(cells: string[], alt = false) {
    const bg = alt ? "#f9fafb" : "white";
    return `<tr style="background:${bg};">${cells.map(c => `<td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;">${c}</td>`).join("")}</tr>`;
  }

  const summaryCards = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr>
        ${[
          ["Open Jobs", openJobCount, "#2563eb"],
          ["New Customers (24h)", newCustomers, "#059669"],
          ["Revenue Today", fmt(Number(revenueToday._sum.amount ?? 0)), "#059669"],
          ["Revenue (7d)", fmt(Number(revenueWeek._sum.amount ?? 0)), "#7c3aed"],
          ["Payments (24h)", `${recentPayments._count} · ${fmt(Number(recentPayments._sum.amount ?? 0))}`, "#d97706"],
        ].map(([label, val, color]) => `
          <td style="padding:4px;">
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;text-align:center;">
              <p style="margin:0;font-size:20px;font-weight:700;color:${color};">${val}</p>
              <p style="margin:4px 0 0;font-size:11px;color:#6b7280;">${label}</p>
            </div>
          </td>`).join("")}
      </tr>
    </table>`;

  let issuesHtml = "";

  if (overdueInvoices.length > 0) {
    issuesHtml += section("⚠️ Overdue Invoices", "#dc2626",
      overdueInvoices.map((inv, i) => row([
        `<a href="${BASE_URL}/invoices/${inv.id}" style="color:#2563eb;">#${inv.invoiceNumber || inv.id.slice(0,8)}</a>`,
        `${inv.job?.customer?.firstName ?? ""} ${inv.job?.customer?.lastName ?? ""}`,
        fmt(Number(inv.totalAmount ?? 0)),
        `Due ${fmtDate(inv.dueDate!)}`,
      ], i % 2 === 1)).join(""),
    );
  }

  if (overdueJobs.length > 0) {
    issuesHtml += section("🔧 Overdue Jobs", "#d97706",
      overdueJobs.map((j, i) => row([
        `<a href="${BASE_URL}/jobs/${j.id}" style="color:#2563eb;">${j.title}</a>`,
        `${j.customer.firstName} ${j.customer.lastName}`,
        j.technician?.name ?? "<span style='color:#9ca3af'>Unassigned</span>",
        `Sched ${fmtDate(j.scheduledAt!)}`,
      ], i % 2 === 1)).join(""),
    );
  }

  if (unassignedJobs.length > 0) {
    issuesHtml += section("👤 Unassigned Jobs", "#7c3aed",
      unassignedJobs.map((j, i) => row([
        `<a href="${BASE_URL}/jobs/${j.id}" style="color:#2563eb;">${j.title}</a>`,
        `${j.customer.firstName} ${j.customer.lastName}`,
        j.status.replace(/_/g, " "),
      ], i % 2 === 1)).join(""),
    );
  }

  if (stalledJobs.length > 0) {
    issuesHtml += section("⏳ Stalled Jobs (7+ days)", "#6b7280",
      stalledJobs.map((j, i) => row([
        `<a href="${BASE_URL}/jobs/${j.id}" style="color:#2563eb;">${j.title}</a>`,
        j.status.replace(/_/g, " "),
        j.technician?.name ?? "Unassigned",
        `Updated ${fmtDate(j.updatedAt)}`,
      ], i % 2 === 1)).join(""),
    );
  }

  if (lowInventory.length > 0) {
    issuesHtml += section("📦 Low Inventory", "#059669",
      lowInventory.map((item, i) => row([
        item.name,
        item.partNumber ?? "—",
        `<span style="color:#dc2626;font-weight:600;">${item.quantityOnHand}</span> on hand`,
        `Reorder at ${item.reorderPoint}`,
      ], i % 2 === 1)).join(""),
    );
  }

  if (expiringWarranties.length > 0) {
    issuesHtml += section("🛡️ Warranties Expiring Soon", "#2563eb",
      expiringWarranties.map((w, i) => row([
        `${w.job?.customer?.firstName ?? ""} ${w.job?.customer?.lastName ?? ""}`,
        `<a href="${BASE_URL}/jobs/${w.jobId}" style="color:#2563eb;">View Job</a>`,
        w.expiryDate ? `Expires ${fmtDate(w.expiryDate)}` : "—",
      ], i % 2 === 1)).join(""),
    );
  }

  if (pendingServiceRequests.length > 0) {
    issuesHtml += section("📋 Pending Service Requests (24h+)", "#d97706",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pendingServiceRequests.map((sr: any, i: number) => row([
        `${sr.customer?.firstName ?? ""} ${sr.customer?.lastName ?? ""}`,
        `<a href="${BASE_URL}/service-requests" style="color:#2563eb;">Review</a>`,
        `Waiting since ${fmtDate(sr.createdAt)}`,
      ], i % 2 === 1)).join(""),
    );
  }

  const statusColor = hasIssues ? "#dc2626" : "#059669";
  const statusText  = hasIssues ? `⚠️ ${issues.length} issue${issues.length > 1 ? "s" : ""} found` : "✅ All systems healthy";

  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:20px;color:#1f2937;">
    <div style="background:linear-gradient(135deg,#1e3a5f,#1e40af);padding:24px;border-radius:10px 10px 0 0;">
      <h1 style="color:white;margin:0;font-size:22px;">B&amp;V Auto — Daily Platform Report</h1>
      <p style="color:#93c5fd;margin:4px 0 0;font-size:13px;">${new Date().toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}</p>
    </div>
    <div style="background:white;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;">

      <div style="background:${hasIssues ? "#fef2f2" : "#f0fdf4"};border:1px solid ${hasIssues ? "#fecaca" : "#bbf7d0"};border-radius:8px;padding:14px;margin-bottom:24px;text-align:center;">
        <p style="margin:0;font-size:16px;font-weight:700;color:${statusColor};">${statusText}</p>
        ${hasIssues ? `<p style="margin:6px 0 0;font-size:13px;color:#6b7280;">${issues.join(" · ")}</p>` : ""}
      </div>

      <h2 style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#374151;margin:0 0 12px;">Platform Summary</h2>
      ${summaryCards}

      ${issuesHtml || `<p style="color:#6b7280;font-size:14px;text-align:center;padding:24px 0;">No issues detected — everything is running smoothly.</p>`}

      <div style="border-top:1px solid #e5e7eb;margin-top:24px;padding-top:16px;text-align:center;">
        <a href="${BASE_URL}/dashboard" style="background:#2563eb;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">Open Dashboard</a>
        <a href="${BASE_URL}/notifications" style="background:#f3f4f6;color:#374151;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;margin-left:8px;">View Notifications</a>
      </div>
    </div>
    <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:12px;">B&amp;V Mobile Auto · Automated daily report · <a href="${BASE_URL}/settings" style="color:#9ca3af;">Manage alerts</a></p>
  </body></html>`;

  // ── Send email ─────────────────────────────────────────────────────────────
  if (resend) {
    await resend.emails.send({
      from: FROM,
      to: ADMIN_EMAIL,
      subject: hasIssues
        ? `⚠️ B&V Auto — ${issues.length} issue${issues.length > 1 ? "s" : ""} need attention`
        : `✅ B&V Auto — Daily report: all systems healthy`,
      html,
    });
  } else {
    console.log("[health-check] Email stub — resend not configured");
  }

  return NextResponse.json({
    ok: true,
    hasIssues,
    issues,
    stats: {
      openJobs: openJobCount,
      overdueInvoices: overdueInvoices.length,
      overdueJobs: overdueJobs.length,
      unassignedJobs: unassignedJobs.length,
      stalledJobs: stalledJobs.length,
      lowInventory: lowInventory.length,
      expiringWarranties: expiringWarranties.length,
      newCustomers,
      revenueToday: Number(revenueToday._sum.amount ?? 0),
      revenueWeek: Number(revenueWeek._sum.amount ?? 0),
    },
  });
}
