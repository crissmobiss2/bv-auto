import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?tab=integrations&error=auth`);

  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?tab=integrations&error=missing_params`);
  }

  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?tab=integrations&error=not_configured`);
  }

  try {
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/integrations/xero/callback`;
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const tokenRes = await fetch("https://identity.xero.com/connect/token", {
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

    // Resolve the Xero tenant
    let tenantId: string | null = null;
    let tenantName = "Xero Organisation";
    try {
      const connRes = await fetch("https://api.xero.com/connections", {
        headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: "application/json" },
      });
      if (connRes.ok) {
        const conns = await connRes.json();
        tenantId = conns?.[0]?.tenantId || null;
        tenantName = conns?.[0]?.tenantName || tenantName;
      }
    } catch {}

    await prisma.settings.upsert({
      where: { key: "xero_connection" },
      create: {
        key: "xero_connection",
        value: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry,
          tenantId,
          tenantName,
          connectedAt: new Date().toISOString(),
        },
      },
      update: {
        value: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiry,
          tenantId,
          tenantName,
          lastSync: new Date().toISOString(),
        },
      },
    });

    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?tab=integrations&connected=xero`);
  } catch {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/settings?tab=integrations&error=xero_callback`);
  }
}
