import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess, logAudit } from "@/lib/api-helpers";
import { AuditAction } from "@prisma/client";
import { z } from "zod";

const itemCondition = z.enum(["GOOD", "FAIR", "NEEDS_ATTENTION", "CRITICAL", "NA"]);

const checklistItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  item: z.string(),
  condition: itemCondition,
  notes: z.string().optional(),
  photoUrls: z.array(z.string()).optional(),
});

const inspectionSchema = z.object({
  mileage: z.number().optional(),
  items: z.array(checklistItemSchema),
  technicianNotes: z.string().optional(),
  recommendedServices: z.array(z.string()).optional(),
});

export const DEFAULT_INSPECTION_ITEMS = [
  // Engine
  { id: "eng-oil", category: "Engine", item: "Engine Oil Level & Condition" },
  { id: "eng-coolant", category: "Engine", item: "Coolant Level & Condition" },
  { id: "eng-belt", category: "Engine", item: "Drive Belts" },
  { id: "eng-hose", category: "Engine", item: "Hoses" },
  { id: "eng-air", category: "Engine", item: "Air Filter" },
  { id: "eng-spark", category: "Engine", item: "Spark Plugs" },
  { id: "eng-battery", category: "Engine", item: "Battery & Terminals" },
  // Brakes
  { id: "brk-front", category: "Brakes", item: "Front Brake Pads" },
  { id: "brk-rear", category: "Brakes", item: "Rear Brake Pads/Shoes" },
  { id: "brk-rotors", category: "Brakes", item: "Rotors/Drums" },
  { id: "brk-fluid", category: "Brakes", item: "Brake Fluid Level & Condition" },
  { id: "brk-lines", category: "Brakes", item: "Brake Lines & Hoses" },
  // Tires & Wheels
  { id: "tire-fl", category: "Tires & Wheels", item: "Front Left Tire Tread & Pressure" },
  { id: "tire-fr", category: "Tires & Wheels", item: "Front Right Tire Tread & Pressure" },
  { id: "tire-rl", category: "Tires & Wheels", item: "Rear Left Tire Tread & Pressure" },
  { id: "tire-rr", category: "Tires & Wheels", item: "Rear Right Tire Tread & Pressure" },
  { id: "wheel-lug", category: "Tires & Wheels", item: "Lug Nuts Torque" },
  // Suspension & Steering
  { id: "sus-shocks", category: "Suspension & Steering", item: "Shocks / Struts" },
  { id: "sus-cv", category: "Suspension & Steering", item: "CV Joints / Axles" },
  { id: "sus-ball", category: "Suspension & Steering", item: "Ball Joints" },
  { id: "sus-tie", category: "Suspension & Steering", item: "Tie Rod Ends" },
  { id: "sus-power", category: "Suspension & Steering", item: "Power Steering Fluid" },
  // Fluids
  { id: "fluid-trans", category: "Fluids", item: "Transmission Fluid" },
  { id: "fluid-diff", category: "Fluids", item: "Differential Fluid" },
  { id: "fluid-wash", category: "Fluids", item: "Windshield Washer Fluid" },
  // Lights & Electrical
  { id: "light-head", category: "Lights & Electrical", item: "Headlights" },
  { id: "light-tail", category: "Lights & Electrical", item: "Tail Lights" },
  { id: "light-brake", category: "Lights & Electrical", item: "Brake Lights" },
  { id: "light-turn", category: "Lights & Electrical", item: "Turn Signals" },
  { id: "light-check", category: "Lights & Electrical", item: "Check Engine Light" },
  // Exhaust
  { id: "exh-system", category: "Exhaust", item: "Exhaust System" },
  // Wipers & Glass
  { id: "wiper-front", category: "Wipers & Glass", item: "Front Wipers" },
  { id: "wiper-rear", category: "Wipers & Glass", item: "Rear Wiper" },
  { id: "glass-wind", category: "Wipers & Glass", item: "Windshield Condition" },
];

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const job = await prisma.job.findUnique({
    where: { id },
    select: { checklist: true, mileageIn: true },
  });

  if (!job) return apiError("Job not found", 404);

  return apiSuccess({
    checklist: job.checklist || null,
    defaultItems: DEFAULT_INSPECTION_ITEMS,
    mileage: job.mileageIn,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  const parsed = inspectionSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message);

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return apiError("Job not found", 404);

  const checklistData = {
    completedAt: new Date().toISOString(),
    completedBy: session!.user.id,
    mileage: parsed.data.mileage,
    items: parsed.data.items,
    technicianNotes: parsed.data.technicianNotes,
    recommendedServices: parsed.data.recommendedServices || [],
  };

  const updated = await prisma.job.update({
    where: { id },
    data: {
      checklist: checklistData,
      mileageIn: parsed.data.mileage ?? job.mileageIn,
    },
  });

  await logAudit(session!.user.id, AuditAction.UPDATE, "Job", id, null, { inspection: "completed" });

  return apiSuccess({ checklist: updated.checklist });
}
