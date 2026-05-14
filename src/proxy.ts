import { NextRequest, NextResponse } from "next/server";
import { jwtDecode } from "jwt-decode";

type SessionPayload = { role?: string; sub?: string };

function getRole(req: NextRequest): string | null {
  try {
    const token =
      req.cookies.get("authjs.session-token")?.value ||
      req.cookies.get("__Secure-authjs.session-token")?.value;
    if (!token) return null;
    const payload = jwtDecode<SessionPayload>(token);
    return payload?.role || null;
  } catch {
    return null;
  }
}

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always-public routes
  if (
    pathname.startsWith("/api/auth") ||
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

  const sessionToken =
    req.cookies.get("authjs.session-token")?.value ||
    req.cookies.get("__Secure-authjs.session-token")?.value;

  if (pathname.startsWith("/login")) {
    if (sessionToken) {
      const role = getRole(req);
      const dest = role === "CUSTOMER" ? "/customer" : role === "TECHNICIAN" ? "/tech" : "/dashboard";
      return NextResponse.redirect(new URL(dest, req.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/") {
    if (!sessionToken) return NextResponse.redirect(new URL("/login", req.url));
    const role = getRole(req);
    const dest = role === "CUSTOMER" ? "/customer" : role === "TECHNICIAN" ? "/tech" : "/dashboard";
    return NextResponse.redirect(new URL(dest, req.url));
  }

  if (!sessionToken) {
    return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, req.url));
  }

  // Prevent customers from accessing the staff dashboard
  const role = getRole(req);
  if (role === "CUSTOMER" && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/customer", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
