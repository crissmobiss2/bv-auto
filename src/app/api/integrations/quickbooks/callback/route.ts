import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?tab=integrations&error=auth`);

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const realmId = searchParams.get("realmId");

  if (!code || !realmId) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?tab=integrations&error=missing_params`);
  }

  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?tab=integrations&error=not_configured`);
  }

  try {
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/integrations/quickbooks/callback`;
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const tokenRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?tab=integrations&error=token_exchange`);
    }

    const tokens = await tokenRes.json();
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Fetch company info
    let companyName = "QuickBooks Company";
    try {
      const companyRes = await fetch(
        `https://quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}`,
        { headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: "application/json" } }
      );
      if (companyRes.ok) {
        const companyData = await companyRes.json();
        companyName = companyData?.CompanyInfo?.CompanyName || companyName;
      }
    } catch {}

    await prisma.settings.upsert({
      where: { key: "quickbooks_connection" },
      create: {
        key: "quickbooks_connection",
        value: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          realmId,
          companyName,
          tokenExpiry,
          connectedAt: new Date().toISOString(),
        },
        description: "QuickBooks Online OAuth connection",
      },
      update: {
        value: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          realmId,
          companyName,
          tokenExpiry,
          connectedAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?tab=integrations&success=quickbooks`);
  } catch (err) {
    console.error("QB OAuth error:", err);
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?tab=integrations&error=oauth_error`);
  }
}
