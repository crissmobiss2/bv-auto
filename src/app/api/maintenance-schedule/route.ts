import { requireAuth, apiError } from "@/lib/api-helpers";

// DISABLED — this route previously had an LLM fabricate maintenance intervals and
// fluid capacities. Those can drive incorrect service recommendations and quotes,
// so it is turned off until a verified maintenance-schedule data source is wired in.
// (Real per-vehicle specs already live in the VehicleSpec table / /api/vehicle-specs.)
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  return apiError(
    "AI maintenance schedules are disabled. Use the OEM maintenance data in the vehicle specs database, or integrate a verified maintenance-schedule source.",
    503
  );
}
