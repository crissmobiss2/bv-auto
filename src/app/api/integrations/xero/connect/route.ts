import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api-helpers";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const clientId = process.env.XERO_CLIENT_ID;
  if (!clientId) return apiError("XERO_CLIENT_ID is not configured in environment variables.");

  const redirectUri = encodeURIComponent(`${process.env.NEXTAUTH_URL}/api/integrations/xero/callback`);
  const scope = encodeURIComponent("openid profile email accounting.transactions accounting.contacts offline_access");
  const state = Buffer.from(Date.now().toString()).toString("base64");

  const url = `https://login.xero.com/identity/connect/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;

  return NextResponse.redirect(url);
}
