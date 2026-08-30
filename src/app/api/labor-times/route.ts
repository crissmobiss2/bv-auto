import { requireAuth, apiError } from "@/lib/api-helpers";

// DISABLED — this route previously had an LLM invent flat-rate labor hours and
// cache them as if they were a Mitchell 1 / AllData system of record. Fabricated
// labor times must not feed a customer quote, so it is turned off until a real
// labor-time data source is integrated.
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  return apiError(
    "Labor-time lookup is not available. Integrate a real flat-rate labor data source to enable it — AI-generated labor times have been disabled.",
    503
  );
}
