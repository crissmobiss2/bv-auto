import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { rateLimit } from "@/lib/rate-limit";

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

// API routes that are intentionally reachable without a session.
// Anything not listed here falls through to the auth check below.
const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/app-version",
  "/api/shop-info",
  "/api/approve",
  "/api/stripe/webhook",
  "/api/sms/webhook",
  "/api/review",
  "/api/portal",
  "/api/photos",
  "/api/tracking/job",
];

// Pages that are intentionally public. The booking POST is public, but the
// booking list is staff-only and is handled separately below.
const PUBLIC_PAGE_PREFIXES = [
  "/approve",
  "/portal",
  "/book",
  "/review",
  "/register",
  "/offline",
  "/track",
  "/icons",
  "/sw.js",
  "/_next",
];

// A customer session may only use its own portal APIs. This is deliberately an
// allowlist: adding a new staff endpoint must not silently expose it to customers.
const CUSTOMER_API_PREFIXES = [
  "/api/customer",
  "/api/push",
];

const CUSTOMER_PAGE_PREFIXES = [
  "/customer",
  "/portal",
  "/approve",
  "/review",
  "/book",
  "/track",
  "/register",
  "/login",
  "/offline",
];

// Technicians get the shop floor, not payroll, reports, accounting or admin.
const TECH_BLOCKED_API_PREFIXES = [
  "/api/payroll",
  "/api/reports",
  "/api/pipeline",
  "/api/fleet",
  "/api/inventory",
  "/api/price-book",
  "/api/warranty",
  "/api/marketing",
  "/api/sequences",
  "/api/reviews",
  "/api/audit",
  "/api/quotes",
  "/api/invoices",
  "/api/users",
  "/api/integrations",
  "/api/purchase-orders",
  "/api/vendors",
];

const TECH_BLOCKED_PAGE_PREFIXES = [
  "/payroll",
  "/reports",
  "/pipeline",
  "/fleet",
  "/inventory",
  "/price-book",
  "/warranty",
  "/marketing",
  "/sequences",
  "/reviews",
  "/shops",
  "/audit",
  "/quotes",
  "/invoices",
  "/users",
];

function getIP(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

function roleDest(role: string | null | undefined) {
  return role === "CUSTOMER" ? "/customer" : role === "TECHNICIAN" ? "/tech" : "/dashboard";
}

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public pages and static assets.
  if (
    matchesPrefix(pathname, PUBLIC_PAGE_PREFIXES) ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json"
  ) {
    return NextResponse.next();
  }

  // Public API routes. Booking GET is intentionally excluded and requires staff.
  if (
    matchesPrefix(pathname, PUBLIC_API_PREFIXES) ||
    (pathname === "/api/booking" && req.method === "POST") ||
    (pathname.startsWith("/api/booking/") && req.method === "POST")
  ) {
    return NextResponse.next();
  }

  // Rate-limit mutating API calls per IP (120 per 10 min).
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

  // Customers are confined to the customer app. This covers /dashboard, /tech,
  // /onboarding and every other staff page, including direct URL navigation.
  if (role === "CUSTOMER") {
    if (pathname.startsWith("/api/")) {
      if (!matchesPrefix(pathname, CUSTOMER_API_PREFIXES)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.next();
    }

    if (!matchesPrefix(pathname, CUSTOMER_PAGE_PREFIXES)) {
      return NextResponse.redirect(new URL("/customer", req.url));
    }
    return NextResponse.next();
  }

  // Technicians keep the shop-floor tools but lose financial/admin surfaces.
  if (role === "TECHNICIAN") {
    if (pathname.startsWith("/api/")) {
      const blocked = TECH_BLOCKED_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
      // Labor Times needs the shop rate settings; the rest of /api/shops is admin.
      const shopsSettings = pathname.startsWith("/api/shops/settings");
      if (blocked && !shopsSettings) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.next();
    }

    if (matchesPrefix(pathname, TECH_BLOCKED_PAGE_PREFIXES)) {
      return NextResponse.redirect(new URL("/tech", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|app-release.apk).*)"],
};
