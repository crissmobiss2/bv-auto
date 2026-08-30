import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { PrintButton } from "./print-button";

const GRADE_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  GOOD:            { label: "Good",             color: "#16a34a", dot: "#22c55e" },
  FAIR:            { label: "Fair",             color: "#ca8a04", dot: "#eab308" },
  NEEDS_ATTENTION: { label: "Needs Attention",  color: "#ea580c", dot: "#f97316" },
  CRITICAL:        { label: "Critical",         color: "#dc2626", dot: "#ef4444" },
  NA:              { label: "N/A",              color: "#9ca3af", dot: "#d1d5db" },
};

export default async function HealthReportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  const job = await prisma.job.findFirst({
    where: { id, shopId: session.user.shopId ?? undefined },
    include: {
      customer: true,
      vehicle: true,
      technician: { select: { name: true } },
      createdBy: { select: { name: true } },
      jobNotes: { orderBy: { createdAt: "asc" }, take: 10, include: { author: { select: { name: true } } } },
      photos: { orderBy: { takenAt: "desc" }, take: 12 },
      quote: { include: { lineItems: { orderBy: { sortOrder: "asc" } } } },
      invoice: { include: { lineItems: { orderBy: { sortOrder: "asc" } } } },
      signatures: { orderBy: { signedAt: "desc" }, take: 1 },
    },
  });

  if (!job) notFound();

  // checklist is stored as JSON on the job
  type ChecklistItem = { id: string; name: string; condition?: string; notes?: string; category?: string };
  const checklistRaw = job.checklist as ChecklistItem[] | null;
  const byCategory: Record<string, ChecklistItem[]> = {};
  if (Array.isArray(checklistRaw)) {
    for (const item of checklistRaw) {
      (byCategory[item.category || "General"] ??= []).push(item);
    }
  }

  const lineItems = job.invoice?.lineItems || job.quote?.lineItems || [];
  const shopName = "B&V Mobile Auto";
  const shopPhone = process.env.TWILIO_PHONE_NUMBER || "(555) 000-0000";

  return (
    <html lang="en">
      <head>
        <title>Vehicle Health Report — {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}</title>
        <style>{`
          @media print {
            body { margin: 0; }
            .no-print { display: none !important; }
            .page-break { page-break-before: always; }
          }
          * { box-sizing: border-box; }
          body { font-family: system-ui, -apple-system, sans-serif; color: #111827; background: #fff; margin: 0; padding: 0; }
          .container { max-width: 800px; margin: 0 auto; padding: 32px 24px; }
          .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 3px solid #1d4ed8; padding-bottom: 20px; margin-bottom: 24px; }
          .shop-name { font-size: 24px; font-weight: 800; color: #1d4ed8; }
          .report-title { font-size: 14px; color: #6b7280; margin-top: 2px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
          .info-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; }
          .info-box h3 { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px 0; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 13px; }
          .info-label { color: #6b7280; }
          .info-value { font-weight: 600; color: #111827; }
          .section-title { font-size: 16px; font-weight: 700; color: #111827; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; }
          .category-title { font-size: 13px; font-weight: 700; color: #374151; margin: 14px 0 6px; }
          .inspection-item { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 6px; margin-bottom: 4px; font-size: 13px; }
          .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
          .grade-badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; margin-left: auto; white-space: nowrap; }
          .line-items-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
          .line-items-table th { text-align: left; padding: 8px 10px; background: #f3f4f6; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #6b7280; }
          .line-items-table td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; }
          .line-items-table tr:last-child td { border-bottom: none; }
          .total-row td { font-weight: 700; background: #f9fafb; }
          .health-score-bar { height: 16px; background: #e5e7eb; border-radius: 8px; overflow: hidden; margin-top: 6px; }
          .health-score-fill { height: 100%; border-radius: 8px; transition: width 0.3s; }
          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; }
          .print-btn { position: fixed; bottom: 24px; right: 24px; background: #1d4ed8; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(29,78,216,0.3); }
          .print-btn:hover { background: #1e40af; }
        `}</style>
      </head>
      <body>
        <div className="container">
          {/* Header */}
          <div className="header">
            <div>
              <div className="shop-name">{shopName}</div>
              <div className="report-title">Vehicle Health Report · #{job.jobNumber}</div>
            </div>
            <div style={{ textAlign: "right", fontSize: "13px", color: "#6b7280" }}>
              <div style={{ fontWeight: 700, color: "#111827" }}>{new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</div>
              <div>{shopPhone}</div>
              <div>bvauto.com</div>
            </div>
          </div>

          {/* Vehicle + Customer Info */}
          <div className="info-grid">
            <div className="info-box">
              <h3>Vehicle</h3>
              <div className="info-row"><span className="info-label">Year/Make/Model</span><span className="info-value">{job.vehicle.year} {job.vehicle.make} {job.vehicle.model}</span></div>
              {job.vehicle.trim && <div className="info-row"><span className="info-label">Trim</span><span className="info-value">{job.vehicle.trim}</span></div>}
              {job.vehicle.vin && <div className="info-row"><span className="info-label">VIN</span><span className="info-value" style={{ fontFamily: "monospace", fontSize: "12px" }}>{job.vehicle.vin}</span></div>}
              {job.vehicle.plate && <div className="info-row"><span className="info-label">Plate</span><span className="info-value">{job.vehicle.plate} {job.vehicle.plateState}</span></div>}
              {job.vehicle.mileage && <div className="info-row"><span className="info-label">Mileage</span><span className="info-value">{job.vehicle.mileage.toLocaleString()} mi</span></div>}
              {job.vehicle.color && <div className="info-row"><span className="info-label">Color</span><span className="info-value">{job.vehicle.color}</span></div>}
            </div>
            <div className="info-box">
              <h3>Customer</h3>
              <div className="info-row"><span className="info-label">Name</span><span className="info-value">{job.customer.firstName} {job.customer.lastName}</span></div>
              {job.customer.phone && <div className="info-row"><span className="info-label">Phone</span><span className="info-value">{job.customer.phone}</span></div>}
              {job.customer.email && <div className="info-row"><span className="info-label">Email</span><span className="info-value">{job.customer.email}</span></div>}
              <div style={{ marginTop: "8px", borderTop: "1px solid #e5e7eb", paddingTop: "8px" }}>
                <div className="info-row"><span className="info-label">Service Advisor</span><span className="info-value">{job.createdBy?.name || "—"}</span></div>
                {job.technician && <div className="info-row"><span className="info-label">Technician</span><span className="info-value">{job.technician.name}</span></div>}
              </div>
            </div>
          </div>

          {/* Inspection Results */}
          {Object.keys(byCategory).length > 0 && (
            <>
              <div className="section-title">Vehicle Inspection</div>
              {Object.entries(byCategory).map(([cat, items]) => (
                <div key={cat}>
                  <div className="category-title">{cat}</div>
                  {items.map((item) => {
                    const cfg = GRADE_CONFIG[item.condition || "NA"] || GRADE_CONFIG.NA;
                    return (
                      <div key={item.id} className="inspection-item" style={{ background: `${cfg.color}10` }}>
                        <div className="dot" style={{ background: cfg.dot }} />
                        <span style={{ flex: 1 }}>{item.name}</span>
                        {item.notes && <span style={{ color: "#6b7280", fontSize: "12px", maxWidth: "200px", textOverflow: "ellipsis", overflow: "hidden" }}>{item.notes}</span>}
                        <span className="grade-badge" style={{ background: `${cfg.color}20`, color: cfg.color }}>{cfg.label}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          )}

          {/* Services & Estimates */}
          {lineItems.length > 0 && (
            <>
              <div className="section-title">Services &amp; Estimate</div>
              <table className="line-items-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Type</th>
                    <th style={{ textAlign: "right" }}>Qty</th>
                    <th style={{ textAlign: "right" }}>Price</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.description}</td>
                      <td style={{ color: "#6b7280", textTransform: "capitalize" }}>{item.type?.toLowerCase()}</td>
                      <td style={{ textAlign: "right" }}>{Number(item.quantity)}</td>
                      <td style={{ textAlign: "right" }}>{formatCurrency(Number(item.unitPrice))}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{formatCurrency(Number(item.total))}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td colSpan={4} style={{ textAlign: "right", paddingRight: "10px", fontSize: "14px" }}>Total Estimate</td>
                    <td style={{ textAlign: "right", fontSize: "16px", color: "#1d4ed8" }}>
                      {formatCurrency(lineItems.reduce((s, i) => s + Number(i.total), 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          )}

          {/* Tech Notes */}
          {job.jobNotes.filter(n => !n.isInternal).length > 0 && (
            <>
              <div className="section-title">Technician Notes</div>
              <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "14px" }}>
                {job.jobNotes.filter(n => !n.isInternal).map((note) => (
                  <div key={note.id} style={{ marginBottom: "10px", paddingBottom: "10px", borderBottom: "1px solid #e5e7eb" }}>
                    <div style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "4px" }}>
                      {note.author?.name} · {new Date(note.createdAt).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: "13px", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{note.content}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Footer */}
          <div className="footer">
            <div>{shopName} · Vehicle Health Report</div>
            <div>Job #{job.jobNumber} · {new Date().toLocaleDateString()}</div>
          </div>
        </div>

        {/* Print button — hidden when printing */}
        <PrintButton />
      </body>
    </html>
  );
}
