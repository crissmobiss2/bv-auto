import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
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
  if (!job.checklist) return apiError("No inspection data found for this job");

  const checklist = job.checklist as {
    items: { id: string; category: string; item: string; condition: string; notes?: string }[];
    mileage?: number;
    technicianNotes?: string;
    completedAt?: string;
  };

  const html = generateInspectionHTML(job, checklist);

  // In production: send via Resend/email
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: "noreply@bvauto.com",
  //   to: job.customer.email,
  //   subject: `Vehicle Inspection Report — ${job.vehicle.year} ${job.vehicle.make} ${job.vehicle.model}`,
  //   html,
  // });

  // For demo: return HTML as preview
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function generateInspectionHTML(
  job: { vehicle: { year: number; make: string; model: string; vin?: string | null }; customer: { firstName: string; lastName: string } },
  checklist: { items: { id: string; category: string; item: string; condition: string; notes?: string }[]; mileage?: number; technicianNotes?: string; completedAt?: string }
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
<h1>B&V Mobile Auto — Vehicle Inspection Report</h1>
<p style="color:#6b7280;font-size:14px">${job.vehicle.year} ${job.vehicle.make} ${job.vehicle.model}${job.vehicle.vin ? ` · VIN: ${job.vehicle.vin}` : ""}</p>
<p style="color:#6b7280;font-size:14px">Customer: ${job.customer.firstName} ${job.customer.lastName}${checklist.mileage ? ` · Mileage: ${checklist.mileage.toLocaleString()}` : ""}</p>
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
  <h2>${cat}</h2>
  ${checklist.items.filter((i) => i.category === cat).map((item) => `
    <div class="item">
      <span>${item.item}</span>
      <div style="text-align:right">
        <span class="condition" style="color:${conditionColor[item.condition]}">${item.condition.replace("_", " ")}</span>
        ${item.notes ? `<p style="font-size:12px;color:#6b7280;margin-top:2px">${item.notes}</p>` : ""}
      </div>
    </div>`).join("")}
`).join("")}

${checklist.technicianNotes ? `
  <div class="notes">
    <strong>Technician Notes:</strong><br>
    ${checklist.technicianNotes}
  </div>` : ""}

<p style="margin-top:32px;font-size:12px;color:#9ca3af;text-align:center">
  Questions? Call B&V Mobile Auto at (555) 000-0000
</p>
</body>
</html>`;
}
