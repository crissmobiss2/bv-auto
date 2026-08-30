import { requireAuth, apiError } from "@/lib/api-helpers";

// DISABLED — this route previously had an LLM produce an emissions "pass/fail"
// readiness verdict. A fabricated readiness verdict can mislead a smog/emissions
// decision, so it is turned off until it reads real OBD-II readiness-monitor data.
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  return apiError(
    "AI emissions-readiness verdicts are disabled. Read the actual OBD-II readiness monitors from the vehicle instead of generating a verdict.",
    503
  );
}
