# 08 — Reports, Payroll, Labor & Accounting Audit

## Verdict
**Ship with fixes.** Payroll and reports are now restricted to `ADMIN`/`ACCOUNTANT`, and payroll correctly includes technicians plus the owner/admin. The calculations are usable, but the section still lacks period locking, CSV-injection protection, refund-aware revenue, and tenant scoping.

## Scorecard
| Dimension | Grade | Notes |
|---|---|---|
| Correctness | B- | Payroll totals work; revenue mixes invoice totals and payments. |
| Security & tenant isolation | B- | Role gate added; no shop scoping. |
| Data integrity | C+ | No period close; retroactive edits change historical payroll. |
| Error handling | B | Date parsing works; invalid ranges can produce empty data silently. |
| UX & accessibility | B | Payroll table is readable; CSV download works. |
| Performance | B- | Reports aggregate on demand; no materialized views. |
| Maintainability | B- | Report queries are spread across dashboard/reports/payroll. |

## Coverage matrix
| Item | Type | Result | Notes |
|---|---|---|---|
| `/reports` | Page/API | PASS | ADMIN/ACCOUNTANT only. |
| `/payroll` | Page/API | PASS | ADMIN/ACCOUNTANT; technicians + owner/admin. |
| Payroll CSV export | API | PASS | Formula-injection neutralized; all cells quoted/escaped. |
| Labor times | Page/API | PASS | Tech time logs feed payroll. |
| Dashboard revenue | API | PASS | Payment-based; shop timezone. |
| Reports revenue | API | PARTIAL | Invoice-based; partial invoices counted fully. |
| Accounting sync (QBO/Xero) | Integration | PARTIAL | Push exists; no idempotency key. |
| Period close/lock | Workflow | FAIL | No lock. |
| Shop scoping | Data | FAIL | See DATA-001. |

## Findings

### [FIN-001] Payroll and reports were reachable by every staff role
- **Severity:** P1
- **Area:** RBAC / compensation privacy
- **Evidence:** `src/app/api/payroll/route.ts`, `src/app/api/reports/route.ts`
- **Problem:** Both routes only required a session. Technicians, dispatchers, and parts staff could read pay rates, gross pay, revenue, and customer spend.
- **Impact:** Compensation and financial data exposure.
- **Reproduce / verify:** Call `GET /api/payroll` as a technician before the fix.
- **Recommended fix:** `requireRole(["ADMIN", "ACCOUNTANT"])`; block `/payroll` and `/reports` in the technician proxy.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [FIN-002] No shop scoping in payroll/reports
- **Severity:** P1
- **Area:** Tenant isolation
- **Evidence:** `src/app/api/payroll/route.ts`, `src/app/api/reports/route.ts`
- **Problem:** Queries aggregate all users/jobs/payments regardless of `shopId`. The reports endpoint accepts a `shopId` parameter but does not derive/verify it from the session.
- **Impact:** A staff user in one shop can read another shop’s payroll and revenue.
- **Reproduce / verify:** Pass another shop’s `shopId` to `/api/reports`.
- **Recommended fix:** Derive the shop from the session; ignore client-supplied `shopId` unless the user is a cross-shop admin; add shop filters to every aggregate.
- **Effort:** L
- **Confidence:** Confirmed.

### [FIN-003] Payroll CSV is vulnerable to spreadsheet formula injection
- **Severity:** P2
- **Area:** Export security
- **Evidence:** `src/app/api/payroll/export/route.ts`
- **Problem:** Names, job titles, and other text are written to CSV without neutralizing cells beginning with `=`, `+`, `-`, or `@`.
- **Impact:** Opening the CSV in Excel can execute formulas or exfiltrate data.
- **Reproduce / verify:** Create a technician named `=HYPERLINK(...)` and export payroll.
- **Recommended fix:** Prefix risky cells with `'` and quote/escape all fields; use a CSV library with formula-injection protection.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [FIN-004] Revenue reports count partial invoices as fully paid
- **Severity:** P2
- **Area:** Financial accuracy
- **Evidence:** `src/app/api/reports/route.ts`, `src/app/api/dashboard/route.ts`
- **Problem:** Some reports sum `Invoice.totalAmount` for invoices in `PAID`/`SENT`, while the dashboard sums `Payment.amount`. A `PARTIAL` invoice contributes its full total in the former and only the paid amount in the latter.
- **Impact:** Revenue depends on which screen you open.
- **Reproduce / verify:** Create a $1,000 invoice with a $100 payment and compare `/dashboard` to `/reports`.
- **Recommended fix:** Define one revenue source of truth (payments received, minus refunds) and use it everywhere; show invoiced vs collected separately.
- **Effort:** M
- **Confidence:** Confirmed — fixed in this pass for summary, top-customer, technician, and gross-profit totals (collected `amountPaid`). Refund-aware reporting remains open under FIN-009.

### [FIN-005] Report `shopId` is client-controlled
- **Severity:** P2
- **Area:** Authorization
- **Evidence:** `src/app/api/reports/route.ts` (query parsing)
- **Problem:** The endpoint trusts `?shopId=` from the caller.
- **Impact:** Cross-shop reporting if more than one shop exists.
- **Recommended fix:** Validate the shop against the session and role; return `403` for a mismatch.
- **Effort:** S
- **Confidence:** Confirmed.

### [FIN-006] No payroll period lock or approval
- **Severity:** P2
- **Area:** Payroll integrity
- **Evidence:** payroll page/API
- **Problem:** Time logs and job assignments can be edited after payroll is calculated; there is no “run payroll” snapshot, approval, or lock.
- **Impact:** Historical pay changes silently; disputes are hard to resolve.
- **Reproduce / verify:** Calculate payroll, edit a time log, recalculate.
- **Recommended fix:** Add a `PayrollRun` snapshot with period start/end, line items, status (`DRAFT`/`APPROVED`/`PAID`), and lock edits after approval.
- **Effort:** L
- **Confidence:** Confirmed.

### [FIN-007] Accounting sync has no idempotency key
- **Severity:** P2
- **Area:** Accounting integration
- **Evidence:** `src/lib/accounting.ts` / integration routes
- **Problem:** Re-running a sync can push duplicate invoices/payments to QuickBooks/Xero.
- **Impact:** Duplicate entries and reconciliation work.
- **Recommended fix:** Store the external ID per record and use an idempotency key; skip already-synced records.
- **Effort:** M
- **Confidence:** Likely.

### [FIN-008] Tax/discount rounding is not centralized
- **Severity:** P2
- **Area:** Financial correctness
- **Evidence:** `src/lib/utils.ts` (`calculateLineItemTotal`), quote/invoice routes
- **Problem:** Line totals, discounts, tax, and rounding are computed in several places with `Number` math.
- **Impact:** One-cent drift between quote, invoice, PDF, and Stripe.
- **Reproduce / verify:** Create a quote with multiple discounted taxable lines and compare totals.
- **Recommended fix:** Centralize money math in integer cents or `Prisma.Decimal`; apply tax once on the taxable subtotal; test rounding cases.
- **Effort:** M
- **Confidence:** Confirmed.

### [FIN-009] Dashboard and reports use different time windows
- **Severity:** P3
- **Area:** Consistency
- **Evidence:** `src/app/api/dashboard/route.ts`, `src/app/api/reports/route.ts`
- **Problem:** Dashboard uses shop-timezone day/week/month; reports may use `from`/`to` dates parsed as UTC or server-local.
- **Impact:** Totals differ around midnight/DST.
- **Recommended fix:** Use the same shop-timezone helper for both and return the exact window in the response.
- **Effort:** S
- **Confidence:** Confirmed.

### [FIN-010] Owner inclusion depends on the ADMIN role
- **Severity:** P3
- **Area:** Payroll UX
- **Evidence:** `src/app/api/payroll/route.ts`
- **Problem:** The owner appears only if their user role is `ADMIN` and they have a pay profile. A shop owner with a different role is omitted.
- **Impact:** Owner pay is missing from reports.
- **Recommended fix:** Add an explicit `includeOwner`/`isOwner` flag or a payroll profile independent of role.
- **Effort:** S
- **Confidence:** Confirmed.

### [FIN-011] No overtime, burden, or reimbursement rules
- **Severity:** P3
- **Area:** Payroll completeness
- **Evidence:** payroll calculation
- **Problem:** Gross pay is hours × rate (or job-based); there is no overtime multiplier, payroll tax/burden, mileage, or reimbursement.
- **Impact:** Payroll is an estimate, not a pay-run source.
- **Recommended fix:** Add configurable OT rules and reimbursement line types; label the export as “estimate” until reconciled.
- **Effort:** L
- **Confidence:** Confirmed.

### [FIN-012] Conversion metrics read fields the API does not return
- **Severity:** P2
- **Area:** Reporting correctness
- **Evidence:** `src/app/(dashboard)/reports/page.tsx:257`, `src/app/api/quotes/conversions/route.ts` (response fields)
- **Problem:** The reports page rendered `convData.rate30`, `convData.rate90`, `convData.avgHoursToApprove`, and `convData.declineReasons`, but the API returns `period30.approvalRate`, `period90.approvalRate`, `avgApprovalHours`, and `topDeclineReasons`. The page showed a bare `%`, `—h`, and never showed decline reasons.
- **Impact:** Approval-rate and approval-time KPIs were blank/undefined on the reports dashboard.
- **Reproduce / verify:** Open `/reports` with at least one sent/approved quote; inspect the Estimate-to-Invoice Conversion cards.
- **Recommended fix:** Use the actual API field names and guard `null` values.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

## What already works well
- Payroll lists technicians and the owner/admin, with hours, job counts, and detail rows.
- Contract vs hourly pay and shop-timezone handling were fixed previously.
- Payroll CSV download works.
- Reports cover revenue, jobs, customers, and technician performance.
- Dashboard revenue is payment-based and now uses shop-local day/week/month boundaries.

## Cross-section references
- Role boundary: `01-auth-security.md` / AUTH-005.
- Tenant scoping: `10-database-data-integrity.md` / DATA-001.
- Refund handling: `04-billing-payments.md` / BILL-009.

## Verification commands / limitations
- `npm run type-check`, `npm run lint`, `npm test -- --run` — clean.
- Payroll figures were not reconciled against a real pay run.
- QuickBooks/Xero sync is `Unverified — needs runtime` because no accounting credentials are configured.
