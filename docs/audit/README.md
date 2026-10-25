# B&V Auto — Full System Audit Workspace

This folder is the single source of truth for the exhaustive audit. Every section gets one auditor workspace and one report. The parent session aggregates reports into `00-EXECUTIVE-SUMMARY.md` and `FIX-PLAN.md`, then creates fix-only child workspaces.

## Ground rules for auditors

1. **Read-only audit.** Do not edit source code, schema, config, `.env`, or tests. The only file you may write is your assigned report.
2. **No destructive or external actions.** Do not run `db push`, `db migrate`, `db seed`, cleanup scripts, deploys, or anything that sends email/SMS/Stripe charges. Do not call paid third-party APIs.
3. **Evidence over opinion.** Every finding needs `path:line` evidence and a concrete impact. If something cannot be proven statically, mark it `Unverified — needs runtime` and give exact verification steps.
4. **Cover the whole section.** Include a coverage matrix listing every page, API route, lib, and component in scope with `PASS`, `FAIL`, or `N/A`. Missing coverage is itself a gap.
5. **Rank by risk, not aesthetics.** Security, money, data loss, broken core workflow, and privacy outrank styling.
6. **Redact secrets.** Never copy secret values into a report. Write `[REDACTED]`.
7. **Be specific and fixable.** Each finding must say what is wrong, why it matters, where it is, how to reproduce/verify, and the smallest correct fix.
8. **Do not duplicate across sections.** If a finding belongs to another section, note it as a cross-reference only.

## Severity

| Severity | Definition |
|---|---|
| **P0 — Critical** | Exploitable security/privacy breach, money loss, data loss/corruption, production outage, or a core workflow that cannot complete. |
| **P1 — High** | Major feature broken, serious security/privacy exposure, or wrong financial/legal output with no reasonable workaround. |
| **P2 — Medium** | Degraded workflow, incorrect edge-case behavior, missing validation/state handling, or notable performance/accessibility issue with a workaround. |
| **P3 — Low** | Polish, consistency, minor UX/code-quality issue, or documentation gap. |

## Finding format

```md
### [AUTH-001] Short title
- **Severity:** P0
- **Area:** Auth / API security
- **Evidence:** `src/app/api/foo/route.ts:42`, `src/lib/api-helpers.ts:6`
- **Problem:** What is wrong, precisely.
- **Impact:** Who is affected and what can happen.
- **Reproduce / verify:** Steps or a command.
- **Recommended fix:** Smallest correct change.
- **Effort:** S / M / L
- **Confidence:** Confirmed / Likely / Unverified
```

## Report skeleton

```md
# 01 — Auth & Security Audit

## Verdict
One paragraph: ship / ship with fixes / do not ship.

## Scorecard
| Dimension | Grade | Notes |
|---|---|---|

## Coverage matrix
| Item | Type | Result | Notes |
|---|---|---|---|

## Findings
### [AUTH-001] ...
...

## What already works well
...

## Cross-section references
...

## Verification commands / limitations
...
```

## Finding ID prefixes

| Prefix | Section |
|---|---|
| AUTH | Authentication, authorization, tenant isolation, API security |
| CRM | Customers, vehicles, fleet, VIN/vehicle data |
| JOBS | Jobs, dispatch, scheduling, inspections, tech portal |
| BILL | Invoices, quotes, approvals, payments, Stripe |
| PORT | Customer portal, public pages, booking, tracking, reviews |
| PART | Parts, inventory, vendors, purchase orders, price book |
| COMM | Marketing, sequences, follow-ups, notifications, SMS/email/push |
| FIN | Reports, payroll, labor times, accounting integrations |
| AI | AI endpoints, diagnostics, repair data, NHTSA/TSB/recalls |
| DATA | Prisma schema, data integrity, migrations, queries |
| PLAT | Platform, infra, PWA/offline, Electron/Capacitor, CI/CD |
| UX | UX, accessibility, responsive, states, design consistency |
| QUAL | Testing, type safety, lint, dead code, docs, build health |
| FLOW | End-to-end business workflow and state machines |

## Reports

| # | Report | Scope |
|---|---|---|
| 00 | `00-EXECUTIVE-SUMMARY.md` | Aggregated verdict, counts, top risks |
| 01 | `01-auth-security.md` | Auth, RBAC, tenant isolation, API security |
| 02 | `02-crm-vehicles.md` | Customers, vehicles, fleet, VIN data |
| 03 | `03-jobs-dispatch-tech.md` | Jobs, dispatch, schedule, inspections, tech portal |
| 04 | `04-billing-payments.md` | Invoices, quotes, approvals, Stripe |
| 05 | `05-customer-portal-public.md` | Portal, tracking, booking, reviews, privacy |
| 06 | `06-parts-inventory.md` | Parts, inventory, vendors, POs, price book |
| 07 | `07-communications-growth.md` | Marketing, sequences, notifications, SMS/email/push |
| 08 | `08-reports-payroll-accounting.md` | Reports, payroll, labor, accounting sync |
| 09 | `09-ai-diagnostics-data.md` | AI, diagnostics, NHTSA/TSB/recalls, repair data |
| 10 | `10-database-data-integrity.md` | Schema, relations, indexes, migrations, queries |
| 11 | `11-platform-infra.md` | Next/Vercel/Electron/Capacitor/PWA/CI/security headers |
| 12 | `12-ux-accessibility.md` | UX, a11y, responsive, loading/empty/error states |
| 13 | `13-quality-testing.md` | Tests, types, lint, dead code, docs, build |
| 14 | `14-workflow-e2e.md` | End-to-end workflow and status transitions |
| — | `FIX-PLAN.md` | Deduplicated, batched fix plan |
| — | `fixes/` | Fix-workspace output reports |
