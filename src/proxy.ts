import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { rateLimit } from "@/lib/rate-limit";

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

function getIP(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

function roleDest(role: string | null | undefined) {
  return role === "CUSTOMER" ? "/customer" : role === "TECHNICIAN" ? "/tech" : "/dashboard";
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always-public routes
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/app-version") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/shop-info") ||
    pathname.startsWith("/api/approve") ||
    pathname.startsWith("/api/stripe/webhook") ||
    pathname.startsWith("/api/sms/webhook") ||
    pathname.startsWith("/api/booking") ||
    pathname.startsWith("/api/review") ||
    pathname.startsWith("/api/portal") ||
    pathname.startsWith("/approve") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/book") ||
    pathname.startsWith("/review") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/offline") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/sw.js") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json"
  ) {
    return NextResponse.next();
  }

  // Rate-limit mutating API calls per IP (120 per 10 min)
  if (pathname.startsWith("/api/") && MUTATING_METHODS.has(req.method)) {
    if (!rateLimit(`api:${req.method}:${getIP(req)}`, 120, 10 * 60_000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  }

  // Auth.js session tokens are JWE-encrypted — getToken decrypts them.
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  const session =
    (await getToken({ req, secret, secureCookie: true })) ??
    (await getToken({ req, secret, secureCookie: false }));
  const role = (session as { role?: string } | null)?.role;

  if (pathname.startsWith("/login")) {
    if (session) {
      return NextResponse.redirect(new URL(roleDest(role), req.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/") {
    if (!session) return NextResponse.redirect(new URL("/login", req.url));
    return NextResponse.redirect(new URL(roleDest(role), req.url));
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, req.url));
  }

  // Prevent customers from accessing the staff dashboard
  if (role === "CUSTOMER" && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/customer", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|app-release.apk).*)"],
};
