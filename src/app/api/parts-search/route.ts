import { requireAuth, apiError } from "@/lib/api-helpers";

// DISABLED — this route previously had an LLM fabricate part numbers, prices and
// stock levels and attributed them to real suppliers. That is unsafe to put in
// front of a customer quote, so live results are turned off until a real supplier
// catalog (NAPA / Worldpac / Nexpart / O'Reilly) is wired in here.
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  return apiError(
    "Live parts search is not available. Connect a supplier catalog integration to enable real pricing — AI-generated pricing has been disabled to prevent quoting unverified parts.",
    503
  );
}
