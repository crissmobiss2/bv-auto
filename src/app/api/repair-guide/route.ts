import { requireAuth, apiError } from "@/lib/api-helpers";

// DISABLED — this route previously had an LLM fabricate torque specs, fluid specs
// and repair steps and claimed they were "better than ALLDATA or Mitchell 1".
// Fabricated torque values are a physical-safety hazard, so it is turned off until
// a verified service-information source is integrated.
export async function POST() {
  const { error } = await requireAuth();
  if (error) return error;

  return apiError(
    "The AI repair guide is disabled. Fabricated torque/fluid/repair specs are unsafe to rely on — use a verified service-information source (ALLDATA / Mitchell 1).",
    503
  );
}
