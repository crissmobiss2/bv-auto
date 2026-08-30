import { requireAuth, apiError } from "@/lib/api-helpers";

// DISABLED — this route previously had an LLM generate ADAS calibration
// requirements and steps. Calibration guidance is safety-critical and must come
// from OEM procedures, so AI generation is turned off. The real per-vehicle ADAS
// fields (adasFeatures / adasCalRequired) are available via /api/vehicle-specs.
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  return apiError(
    "AI ADAS calibration guidance is disabled. Follow OEM calibration procedures — the vehicle specs database exposes the ADAS feature/calibration flags for reference.",
    503
  );
}
