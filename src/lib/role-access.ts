// Central role and path policy. Kept free of Prisma/Next imports so the
// proxy boundary can be tested without booting the app.

export const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/app-version",
  "/api/shop-info",
  "/api/signup",
  "/api/approve",
  "/api/stripe/webhook",
  "/api/billing/webhook",
  "/api/sms/webhook",
  "/api/review",
  "/api/portal",
  "/api/tracking/job",
];

export const PUBLIC_PAGE_PREFIXES = [
  "/robots.txt",
  "/sitemap.xml",
  "/privacy",
  "/terms",
  "/approve",
  "/portal",
  "/book",
  "/review",
  "/register",
  "/signup",
  "/reset",
  "/offline",
  "/track",
  "/icons",
  "/sw.js",
  "/_next",
];

// A customer session may only use its own portal APIs. This is deliberately an
// allowlist: adding a new staff endpoint must not silently expose it to customers.
export const CUSTOMER_API_PREFIXES = ["/api/customer", "/api/push"];

export const CUSTOMER_PAGE_PREFIXES = [
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
// Keep singular and plural route names: /api/warranty is the page/legacy name,
// while the API is /api/warranties.
export const TECH_BLOCKED_API_PREFIXES = [
  "/api/payroll",
  "/api/reports",
  "/api/pipeline",
  "/api/fleet",
  "/api/inventory",
  "/api/price-book",
  "/api/warranty",
  "/api/warranties",
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

export const TECH_BLOCKED_PAGE_PREFIXES = [
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
  "/billing",
  "/audit",
  "/quotes",
  "/invoices",
  "/users",
];

// Only office roles may see customer revenue, invoice history and CLV.
// Technicians and parts coordinators still get contact, vehicle and job data.
export const CUSTOMER_FINANCIAL_ROLES = new Set([
  "ADMIN",
  "DISPATCHER",
  "ACCOUNTANT",
  "SERVICE_ADVISOR",
]);

// Warranty pages are admin/dispatcher surfaces in the navigation.
export const WARRANTY_ROLES: string[] = ["ADMIN", "DISPATCHER"];

export function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isTechnicianApiBlocked(pathname: string) {
  if (!matchesPrefix(pathname, TECH_BLOCKED_API_PREFIXES)) return false;
  // Labor Times needs the shop rate settings; the rest of /api/shops is admin.
  return !pathname.startsWith("/api/shops/settings");
}

export function isTechnicianPageBlocked(pathname: string) {
  return matchesPrefix(pathname, TECH_BLOCKED_PAGE_PREFIXES);
}

export function isCustomerApiAllowed(pathname: string) {
  return matchesPrefix(pathname, CUSTOMER_API_PREFIXES);
}

export function isCustomerPageAllowed(pathname: string) {
  return matchesPrefix(pathname, CUSTOMER_PAGE_PREFIXES);
}

export function canViewCustomerFinancials(role?: string | null) {
  return !!role && CUSTOMER_FINANCIAL_ROLES.has(role);
}
