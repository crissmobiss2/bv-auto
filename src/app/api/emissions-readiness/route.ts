import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// State emissions test requirements
const STATE_REQUIREMENTS: Record<string, { hasTest: boolean; obd2Year: number; testType: string; notes: string }> = {
  CA: { hasTest: true,  obd2Year: 1996, testType: "OBD-II + Visual", notes: "Strictest in US. BAR-OIS program. All monitors must be ready except EVAP." },
  TX: { hasTest: true,  obd2Year: 1996, testType: "OBD-II",          notes: "Required in 17 counties. Two incomplete monitors allowed on 1996-2000 vehicles." },
  NY: { hasTest: true,  obd2Year: 1996, testType: "OBD-II",          notes: "One incomplete monitor allowed. Enhanced program areas." },
  IL: { hasTest: true,  obd2Year: 1996, testType: "OBD-II",          notes: "Chicago area only. Two incomplete monitors allowed." },
  PA: { hasTest: true,  obd2Year: 1996, testType: "OBD-II + Visual", notes: "Enhanced in SE PA counties." },
  FL: { hasTest: false, obd2Year: 0,    testType: "None",             notes: "No statewide emissions test required." },
  AZ: { hasTest: true,  obd2Year: 1996, testType: "OBD-II",          notes: "Maricopa and Pima counties only." },
  GA: { hasTest: true,  obd2Year: 1996, testType: "OBD-II",          notes: "13 metro Atlanta counties." },
  CO: { hasTest: true,  obd2Year: 1982, testType: "OBD-II",          notes: "Denver metro area. Vehicles older than 7 years exempt." },
  WA: { hasTest: true,  obd2Year: 1996, testType: "OBD-II",          notes: "Clark, King, Pierce, Snohomish, Spokane counties." },
  OH: { hasTest: true,  obd2Year: 1996, testType: "OBD-II",          notes: "11 counties in NE Ohio." },
  VA: { hasTest: true,  obd2Year: 1996, testType: "OBD-II + Safety", notes: "Statewide combined safety + emissions." },
  MD: { hasTest: true,  obd2Year: 1996, testType: "OBD-II",          notes: "Statewide for vehicles 2-7 years old." },
  NJ: { hasTest: true,  obd2Year: 1996, testType: "OBD-II",          notes: "Statewide. Tight standards." },
  NC: { hasTest: true,  obd2Year: 1996, testType: "OBD-II",          notes: "48 of 100 counties." },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year  = searchParams.get("year");
  const make  = searchParams.get("make");
  const model = searchParams.get("model");
  const state = searchParams.get("state")?.toUpperCase();
  const monitors = searchParams.get("monitors"); // comma-separated incomplete monitor list

  const stateReq = state ? STATE_REQUIREMENTS[state] : null;

  // AI analysis of monitor readiness
  if (monitors && year && make) {
    const incompleteList = monitors.split(",").map(m => m.trim());
    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        messages: [{
          role: "user",
          content: `For a ${year} ${make} ${model || ""}, these OBD-II monitors are NOT READY: ${incompleteList.join(", ")}.
${stateReq ? `The vehicle is in ${state} which requires: ${stateReq.testType}.` : ""}

Return JSON:
{
  "willPass": true | false,
  "reason": "...",
  "driveCycle": [{"monitor": "...", "conditions": "...", "estimatedMiles": 20}],
  "tips": ["..."]
}`
        }],
      });

      const text = (response.content[0] as { text: string }).text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      return NextResponse.json({
        vehicle: `${year} ${make} ${model || ""}`,
        state: state || null,
        stateRequirements: stateReq,
        incompleteMonitors: incompleteList,
        analysis: jsonMatch ? JSON.parse(jsonMatch[0]) : null,
        allStates: STATE_REQUIREMENTS,
      });
    } catch {
      // fall through
    }
  }

  return NextResponse.json({
    vehicle: year && make ? `${year} ${make} ${model || ""}` : null,
    state: state || null,
    stateRequirements: stateReq,
    allStates: STATE_REQUIREMENTS,
  });
}
