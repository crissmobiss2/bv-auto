import { NextResponse } from "next/server";
import { requireRole, apiError } from "@/lib/api-helpers";

export async function GET() {
  const { error } = await requireRole(["ADMIN"]);
  if (error) return error;

  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  if (!clientId) return apiError("QUICKBOOKS_CLIENT_ID is not configured in environment variables.");

  const redirectUri = encodeURIComponent(`${process.env.NEXTAUTH_URL}/api/integrations/quickbooks/callback`);
  const scope = encodeURIComponent("com.intuit.quickbooks.accounting");
  const state = Buffer.from(Date.now().toString()).toString("base64");

  const url = `https://appcenter.intuit.com/connect/oauth2?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;

  return NextResponse.redirect(url);
}
