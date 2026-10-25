# 14 — End-to-End Workflow & State Machine Audit

## Verdict
**Ship with fixes.** The primary workflow now completes honestly: customer → vehicle → job → quote → approval → invoice → payment, with real send results and balance-aware payment status. The remaining workflow gaps are booking notifications, deposits, refunds, inventory receiving, cancellation/no-show, and a formal status-transition map.

## Scorecard
| Dimension | Grade | Notes |
|---|---|---|
| Correctness | B | Core path works; some manual steps remain. |
| Security & tenant isolation | B- | Role/ownership checks improved; no shop scope. |
| Data integrity | B- | Money fixed; inventory/refund gaps. |
| Error handling | B | Real failures surfaced in key steps. |
| UX & accessibility | B- | Clear next actions on job/invoice; portal pay unclear. |
| Performance | B | Cron/reminder windows are fixed schedules. |
| Maintainability | B- | Status values are consistent but rules are implicit. |

## Coverage matrix
| Workflow | Result | Notes |
|---|---|---|
| Public booking → lead | PARTIAL | Creates record; no confirmation/staff alert. |
| Lead → customer/vehicle | PASS | Inline create. |
| Customer/vehicle → job | PASS | Relation validated. |
| Job → quote | PASS | Customer/job match validated. |
| Quote → approval | PASS | Expiry + race-safe; real send. |
| Approval → invoice | PASS | Requires approved quote. |
| Invoice → payment | PASS | Stripe/manual; overpay blocked. |
| Payment → receipt/PDF | PASS | Escaped PDF; payment history. |
| Job completion → review | PARTIAL | Cron/manual; no auto trigger. |
| Parts request → receive | PARTIAL | No receiving reconciliation. |
| Refund/void | FAIL | No reversal. |
| Deposit | FAIL | Fields only. |
| Cancellation/no-show | FAIL | No dedicated flow. |
| Split payment display | PARTIAL | Date/method shown; no type. |

## Findings

### [FLOW-001] Quote → approval → invoice → payment is now honest
- **Severity:** P1 (pre-fix)
- **Area:** Core revenue workflow
- **Evidence:** `src/app/api/quotes/[id]/send/route.ts`, `src/app/api/approve/[token]/route.ts`, `src/app/api/invoices/route.ts`, `src/app/api/stripe/webhook/route.ts`
- **Problem:** Previously a quote could be marked sent without delivery, an unapproved quote could be invoiced, and a partial/duplicate Stripe event could mark an invoice paid.
- **Impact:** Revenue leakage and false records.
- **Recommended fix:** Already applied: real send result, approved-quote gate, serializable/deduped payments, balance-aware status.
- **Effort:** M
- **Confidence:** Confirmed — fixed in this pass.

### [FLOW-002] Existing customers cannot safely self-claim an account
- **Severity:** P1
- **Area:** Onboarding
- **Evidence:** `src/app/api/auth/register/route.ts:38`
- **Problem:** Auto-linking by email was an account-takeover vector, so registration now blocks existing customer emails and asks them to contact the shop. That is safe but creates a manual onboarding step.
- **Impact:** Existing customers cannot access the portal without staff help.
- **Recommended fix:** Add a verified-email claim flow (magic link or one-time code) that links the `User` to the existing `Customer` after proof of ownership.
- **Effort:** M
- **Confidence:** Confirmed — security fixed; UX follow-up open.

### [FLOW-003] Booking has no confirmation or staff alert
- **Severity:** P2
- **Area:** Lead response
- **Evidence:** `src/app/api/booking/route.ts`
- **Problem:** A booking creates a record but does not confirm to the customer or notify staff.
- **Impact:** Leads can go stale; customers may book elsewhere.
- **Recommended fix:** Send a confirmation with a reference number and notify staff via push/email; add an SLA/“new lead” badge.
- **Effort:** M
- **Confidence:** Confirmed.

### [FLOW-004] Job completion does not trigger invoice/review automatically
- **Severity:** P2
- **Area:** Handoff
- **Evidence:** job status routes, review cron
- **Problem:** Completing a job does not create an invoice or queue a review request; staff must remember both.
- **Impact:** Unbilled work and missed reviews.
- **Recommended fix:** On `COMPLETED`, prompt “Create invoice” and queue a review request after payment/close; keep manual override.
- **Effort:** M
- **Confidence:** Confirmed.

### [FLOW-005] Parts request → receive → install has no enforced state machine
- **Severity:** P2
- **Area:** Parts workflow
- **Evidence:** job parts routes, purchase orders
- **Problem:** Statuses can be set arbitrarily; receiving a PO does not update job-part status or inventory.
- **Impact:** Techs think a part is in when it is not; stock drifts.
- **Recommended fix:** Define transitions (`REQUESTED → ORDERED → RECEIVED → INSTALLED`), require a receive action, and update inventory in a transaction.
- **Effort:** M
- **Confidence:** Confirmed.

### [FLOW-006] Deposits are not collected
- **Severity:** P2
- **Area:** Revenue protection
- **Evidence:** `Quote.depositRequired`/`depositPaid`, no deposit checkout
- **Problem:** A quote can require a deposit, but there is no payment flow or gate before work.
- **Impact:** No-shows and unsecured special-order parts.
- **Recommended fix:** Add a deposit checkout, show paid/remaining, and optionally block scheduling until paid.
- **Effort:** M
- **Confidence:** Confirmed.

### [FLOW-007] Overdue reminders can duplicate
- **Severity:** P2
- **Area:** Collections
- **Evidence:** `src/app/api/cron/overdue/route.ts`
- **Problem:** The cron can send multiple reminders in the same period if run more than once; there is no per-day/per-invoice dedupe.
- **Impact:** Customer annoyance and SMS cost.
- **Recommended fix:** Store `lastReminderAt`/`reminderCount` and enforce a minimum interval; skip if paid.
- **Effort:** S
- **Confidence:** Confirmed.

### [FLOW-008] Review request window can miss jobs
- **Severity:** P2
- **Area:** Reputation
- **Evidence:** `src/app/api/cron/reviews/route.ts`
- **Problem:** The cron selects jobs completed in a narrow window; if the cron fails or is delayed, those jobs never get a request.
- **Impact:** Missed reviews.
- **Recommended fix:** Use a durable queue/`reviewRequestedAt` flag and a catch-up window; retry failures.
- **Effort:** S
- **Confidence:** Confirmed.

### [FLOW-009] No cancellation/no-show workflow
- **Severity:** P2
- **Area:** Scheduling
- **Evidence:** job statuses, dispatch UI
- **Problem:** `CANCELLED` exists, but there is no reason code, fee, customer notification, or slot release behavior.
- **Impact:** Inconsistent schedule and no record of why work was lost.
- **Recommended fix:** Add cancellation reasons, optional fee, notification, and audit; release the dispatch slot.
- **Effort:** M
- **Confidence:** Confirmed.

### [FLOW-010] Split payments lack a type/date/remaining breakdown
- **Severity:** P2
- **Area:** Billing UX
- **Evidence:** `src/app/(dashboard)/invoices/[id]/page.tsx:344`
- **Problem:** History shows method/reference/date but not whether each row is a deposit, partial, final, or refund; the remaining balance after each row is not shown.
- **Impact:** Hard to explain a split payment to a customer.
- **Recommended fix:** Add payment `type`, show running balance, and group deposits separately.
- **Effort:** S
- **Confidence:** Confirmed.

### [FLOW-011] Customer portal payment path is unclear
- **Severity:** P2
- **Area:** Collections
- **Evidence:** `src/app/portal/[token]/page.tsx`
- **Problem:** Invoices are visible, but there is no prominent “Pay now” action.
- **Impact:** Customers call instead of paying online.
- **Recommended fix:** Add a per-invoice pay button that creates a Stripe Checkout session and returns to the portal.
- **Effort:** M
- **Confidence:** Confirmed.

### [FLOW-012] No mid-job additional-work approval flow
- **Severity:** P2
- **Area:** Authorization/contracts
- **Evidence:** job/quote routes
- **Problem:** A tech can find additional work, but there is no “supplemental quote” tied to the same job with its own approval before work continues.
- **Impact:** Unapproved work and billing disputes.
- **Recommended fix:** Allow multiple quotes per job (or a `Supplement` model) with approval status and a clear “work paused pending approval” state.
- **Effort:** L
- **Confidence:** Confirmed.

## What already works well
- The primary revenue workflow can now be completed without fake success.
- Quote approval is race-safe and expiry-aware.
- Invoice creation requires an approved quote.
- Payments are balance-aware and overpayment-blocked.
- Customer portal links are generated on invoice send.
- Invoice PDFs are escaped and include payment history.

## Cross-section references
- Money fixes: `04-billing-payments.md`.
- Portal payment: `05-customer-portal-public.md`.
- Inventory receiving: `06-parts-inventory.md`.
- Status transitions: `03-jobs-dispatch-tech.md` / JOBS-005.

## Verification commands / limitations
- `npm run type-check`, `npm run lint`, `npm test -- --run` — clean.
- The full workflow was exercised with a local database and mocked integrations; live Stripe/SMS/email steps are `Unverified — needs runtime`.
- Deposits, refunds, and supplemental quotes are not implemented, so they cannot be runtime-tested.
