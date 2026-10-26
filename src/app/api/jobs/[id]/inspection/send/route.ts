import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { getBranding } from "@/lib/shop";
import { sendInspectionEmail, emailConfigured, escapeHtml } from "@/lib/email";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      customer: true,
      vehicle: true,
    },
  });

  if (!job) return apiError("Job not found", 404);
  if (session!.user.role === "TECHNICIAN" && job.technicianId !== session!.user.id) {
    return apiError("You can only send inspections for jobs assigned to you", 403);
  }
  if (!job.checklist) return apiError("No inspection data found for this job");
  if (!job.customer.email) {
    return apiError("Customer has no email address on file. Add one before sending the inspection.", 400);
  }
  if (!emailConfigured) {
    return apiError("Email is not configured (missing RESEND_API_KEY)", 503);
  }

  const checklist = job.checklist as {
    items: { id: string; category: string; item: string; condition: string; notes?: string }[];
    mileage?: number;
    technicianNotes?: string;
    completedAt?: string;
  };
  if (!Array.isArray(checklist.items)) {
    return apiError("Inspection data is invalid", 400);
  }

  const { name: shopName, phone } = await getBranding();
  const html = generateInspectionHTML(job, checklist, phone, shopName);

  try {
    await sendInspectionEmail({
      to: job.customer.email,
      customerName: `${job.customer.firstName} ${job.customer.lastName}`,
      vehicleDescription: `${job.vehicle.year} ${job.vehicle.make} ${job.vehicle.model}`,
      inspectionHtml: html,
      jobId: job.id,
    });
  } catch (e) {
    return apiError(e instanceof Error ? e.message : "Inspection email failed to send", 502);
  }

  return apiSuccess({ sent: true, to: job.customer.email });
}

function generateInspectionHTML(
  job: { vehicle: { year: number; make: string; model: string; vin?: string | null }; customer: { firstName: string; lastName: string } },
  checklist: { items: { id: string; category: string; item: string; condition: string; notes?: string }[]; mileage?: number; technicianNotes?: string; completedAt?: string },
  phone: string | null = null,
  shopName = "",
) {
  const conditionColor: Record<string, string> = {
    GOOD: "#16a34a",
    FAIR: "#ca8a04",
    NEEDS_ATTENTION: "#ea580c",
    CRITICAL: "#dc2626",
    NA: "#9ca3af",
  };

  const categories = Array.from(new Set(checklist.items.map((i) => i.category)));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Vehicle Inspection Report</title>
<style>
  body { font-family: -apple-system, sans-serif; color: #1f2937; padding: 32px; max-width: 700px; margin: 0 auto; background: white; }
  h1 { color: #1d4ed8; font-size: 22px; }
  h2 { font-size: 16px; font-weight: 600; color: #374151; margin: 20px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
  .item { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px solid #f9fafb; }
  .condition { font-weight: 600; padding: 2px 8px; border-radius: 4px; font-size: 12px; background: #f9fafb; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
  .summary-card { text-align: center; padding: 12px; border-radius: 8px; }
  .notes { background: #f9fafb; padding: 12px; border-radius: 8px; font-size: 13px; margin-top: 16px; }
</style>
</head>
<body>
<h1>${escapeHtml(shopName)} — Vehicle Inspection Report</h1>
<p style="color:#6b7280;font-size:14px">${escapeHtml(String(job.vehicle.year))} ${escapeHtml(job.vehicle.make)} ${escapeHtml(job.vehicle.model)}${job.vehicle.vin ? ` · VIN: ${escapeHtml(job.vehicle.vin)}` : ""}</p>
<p style="color:#6b7280;font-size:14px">Customer: ${escapeHtml(job.customer.firstName)} ${escapeHtml(job.customer.lastName)}${checklist.mileage ? ` · Mileage: ${checklist.mileage.toLocaleString()}` : ""}</p>
${checklist.completedAt ? `<p style="color:#9ca3af;font-size:12px">Inspected: ${new Date(checklist.completedAt).toLocaleString()}</p>` : ""}

<div class="summary">
  ${["CRITICAL", "NEEDS_ATTENTION", "FAIR", "GOOD"].map((c) => {
    const count = checklist.items.filter((i) => i.condition === c).length;
    return `<div class="summary-card" style="background:${c === "CRITICAL" ? "#fef2f2" : c === "NEEDS_ATTENTION" ? "#fff7ed" : c === "FAIR" ? "#fefce8" : "#f0fdf4"}">
      <p style="font-size:24px;font-weight:700;color:${conditionColor[c]}">${count}</p>
      <p style="font-size:12px;font-weight:600;color:${conditionColor[c]}">${c.replace("_", " ")}</p>
    </div>`;
  }).join("")}
</div>

${categories.map((cat) => `
  <h2>${escapeHtml(cat)}</h2>
  ${checklist.items.filter((i) => i.category === cat).map((item) => `
    <div class="item">
      <span>${escapeHtml(item.item)}</span>
      <div style="text-align:right">
        <span class="condition" style="color:${conditionColor[item.condition] || "#9ca3af"}">${escapeHtml(item.condition.replace("_", " "))}</span>
        ${item.notes ? `<p style="font-size:12px;color:#6b7280;margin-top:2px">${escapeHtml(item.notes)}</p>` : ""}
      </div>
    </div>`).join("")}
`).join("")}

${checklist.technicianNotes ? `
  <div class="notes">
    <strong>Technician Notes:</strong><br>
    ${escapeHtml(checklist.technicianNotes)}
  </div>` : ""}

${phone ? `<p style="margin-top:32px;font-size:12px;color:#9ca3af;text-align:center">Questions? Call ${escapeHtml(shopName)} at ${escapeHtml(phone)}</p>` : ""}
</body>
</html>`;
}
