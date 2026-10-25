# 04 — Billing, Quotes & Payments Audit

## Verdict
**Ship with fixes.** This was the highest-risk section: duplicate Stripe payments, overpayment, invoices created from unapproved quotes, fake “sent” states, and stored XSS in the invoice PDF were all real. Those are fixed. Remaining gaps are refunds/voids, Stripe session expiry, manual-payment idempotency, and deposits.

## Scorecard
| Dimension | Grade | Notes |
|---|---|---|
| Correctness | B | Payment totals recomputed server-side; quote approval required. |
| Security & tenant isolation | B- | PDF escaping and role checks added; no shop scoping. |
| Data integrity | B | Serializable payment transactions; no refund reversal. |
| Error handling | B | Real 502/503 on provider failure; some Stripe errors masked. |
| UX & accessibility | B | Payment history shows method/date; split payment type still ambiguous. |
| Performance | B | PDF generation is synchronous; fine for single invoices. |
| Maintainability | B- | Billing logic is spread across invoice, Stripe, PDF, and plan routes. |

## Coverage matrix
| Item | Type | Result | Notes |
|---|---|---|---|
| `/quotes` list/create | Page/API | PASS | Customer/job relation validated. |
| `/quotes/[id]` builder | Page/API | PASS | Line items, tax, markup. |
| Quote send | API | PASS | Only marks SENT on real email/SMS delivery. |
| `/approve/[token]` | Public page/API | PASS | Expiry + serializable double-approval guard. |
| `/invoices` list/create | Page/API | PASS | Status validated; quote must be approved. |
| `/invoices/[id]` | Page/API | PASS | Payments, plan, PDF, send, collect. |
| Manual payment | API | PASS | Overpayment blocked; serializable recompute. |
| Stripe checkout | API/lib | PASS | Real session; amount from DB. |
| Stripe webhook | API | PASS | Paid-only, dedupe, serializable, balance-aware. |
| Payment plan PATCH | API | PASS | Installment ownership/amount validated. |
| Invoice PDF | lib | PASS | Escaped user data. |
| Refund/void reversal | Workflow | FAIL | No reversal of payments. |
| Deposit flow | Workflow | FAIL | `depositRequired` is stored but not collected. |

## Findings

### [BILL-001] Stripe webhook could record duplicate payments and mark partial invoices paid
- **Severity:** P0
- **Area:** Money integrity
- **Evidence:** `src/app/api/stripe/webhook/route.ts`
- **Problem:** The webhook processed checkout events without checking `payment_status`, did not deduplicate by PaymentIntent/session, and set the invoice to `PAID` based on the event rather than the remaining balance. Stripe retries and partial payments could create duplicate `Payment` rows or a false `PAID` status.
- **Impact:** Customers charged twice; revenue reports wrong; invoices marked paid with a balance.
- **Reproduce / verify:** Send the same `checkout.session.completed` twice, or pay a partial amount.
- **Recommended fix:** Only process `payment_status === "paid"`; dedupe by `payment_intent`/session ID; record inside a serializable transaction; compute `amountDue` and set `PAID`/`PARTIAL` from the actual balance.
- **Effort:** M
- **Confidence:** Confirmed — fixed in this pass at application level. The webhook skips unpaid sessions, dedupes on PaymentIntent (or session id) stored in `Payment.reference`, re-checks inside a Serializable transaction, and sets `PAID`/`PARTIAL` from the recomputed balance. There is still no database unique constraint on the external ID (DATA-006). Not exercised against live Stripe.

### [BILL-002] Manual payment accepted overpayment and arbitrary fields
- **Severity:** P1
- **Area:** Money integrity / mass assignment
- **Evidence:** `src/app/api/invoices/[id]/route.ts` (POST payment)
- **Problem:** The route accepted a payment amount without comparing it to `amountDue`, allowed void/refunded invoices, and spread request fields into the payment record.
- **Impact:** Negative balances, wrong payment metadata, payments on void invoices.
- **Reproduce / verify:** POST a payment larger than the balance or to a `VOID` invoice.
- **Recommended fix:** Reject void/refunded invoices; require `0 < amount <= amountDue`; whitelist `method`, `reference`, `receivedAt`, `notes`; recompute all payments in a serializable transaction.
- **Effort:** M
- **Confidence:** Confirmed — fixed in this pass.

### [BILL-003] Invoice could be created from a draft/sent quote
- **Severity:** P1
- **Area:** Financial workflow
- **Evidence:** `src/app/api/invoices/route.ts` (POST)
- **Problem:** The invoice creation route copied the job’s quote regardless of quote status.
- **Impact:** Customers billed for work they never approved; quote/invoice mismatch.
- **Reproduce / verify:** Create a `DRAFT` quote and POST `/api/invoices` for that job.
- **Recommended fix:** Require quote status `APPROVED` or `CONVERTED`; return `400` otherwise.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [BILL-004] Invoice send marked `SENT` even when nothing was delivered
- **Severity:** P1
- **Area:** Communication truthfulness
- **Evidence:** `src/app/api/invoices/[id]/send/route.ts`
- **Problem:** The route set `status: SENT` and `sentAt` before/without confirming email or SMS delivery, and fell back to a staff-only invoice URL for customers.
- **Impact:** Staff believe the customer received the invoice; customer link 404s/redirects to login.
- **Reproduce / verify:** Send with no `RESEND_API_KEY`/Twilio config and inspect the invoice status.
- **Recommended fix:** Attempt each configured channel; only mark `SENT` if at least one succeeds; return `sent: false` with errors otherwise; create a portal token on first send so the link works.
- **Effort:** M
- **Confidence:** Confirmed — fixed in this pass.

### [BILL-005] Text-to-pay reported success without Stripe or Twilio
- **Severity:** P1
- **Area:** Payment communication
- **Evidence:** `src/app/api/invoices/[id]/text-to-pay/route.ts`
- **Problem:** The route returned success and a fake/placeholder link even when Stripe or SMS was not configured.
- **Impact:** Customers never receive a payment link; staff think they do.
- **Reproduce / verify:** Call text-to-pay with `TWILIO_*` unset.
- **Recommended fix:** Require SMS configuration and a real Stripe payment URL; return `503`/`502` with the actual reason.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [BILL-006] Invoice PDF contained stored XSS
- **Severity:** P1
- **Area:** PDF/render security
- **Evidence:** `src/lib/pdf.ts` (invoice HTML template)
- **Problem:** Customer names, vehicle fields, line-item descriptions, notes, and title were interpolated into HTML without escaping.
- **Impact:** A malicious customer/line-item value could execute script in the PDF renderer or browser preview.
- **Reproduce / verify:** Create a customer named `<img src=x onerror=alert(1)>` and generate the PDF.
- **Recommended fix:** Escape every dynamic field with `escapeHtml`; keep numeric fields numeric.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [BILL-007] Payment-plan PATCH could modify another invoice’s installment
- **Severity:** P1
- **Area:** Object-level authorization / money
- **Evidence:** `src/app/api/invoices/[id]/payment-plan/route.ts`
- **Problem:** The route accepted an installment ID and updated it without verifying it belonged to the invoice in the URL; it also allowed a paid amount greater than the installment.
- **Impact:** Cross-invoice payment manipulation and impossible balances.
- **Reproduce / verify:** PATCH invoice A’s plan with an installment ID from invoice B.
- **Recommended fix:** Fetch the installment with `invoiceId` in the where clause; validate `paidAmount <= amount`; derive status (PENDING/PARTIAL/PAID).
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [BILL-008] Stripe checkout reuses an expired session forever
- **Severity:** P2
- **Area:** Payment UX
- **Evidence:** `src/app/api/invoices/[id]/collect/route.ts:27`
- **Problem:** If `stripePaymentUrl` and `stripeSessionId` exist, the route returns them without checking whether the Stripe Checkout session expired (default 24h).
- **Impact:** Customer clicks “pay” and lands on an expired session.
- **Reproduce / verify:** Create a checkout session, wait for expiry (or retrieve session status), call collect again.
- **Recommended fix:** Retrieve the session from Stripe and create a new one if `status === "expired"`; clear stale fields.
- **Effort:** S
- **Confidence:** Confirmed.

### [BILL-009] No refund/void payment reversal
- **Severity:** P2
- **Area:** Accounting integrity
- **Evidence:** `src/app/api/invoices/[id]/route.ts` (PATCH status), payment model
- **Problem:** Marking an invoice `VOID` or `REFUNDED` does not reverse or offset recorded payments; there is no refund record.
- **Impact:** Revenue reports and customer balances stay wrong after a refund.
- **Reproduce / verify:** Record a payment, set the invoice to `REFUNDED`, inspect totals.
- **Recommended fix:** Add refund/credit records (negative payments or a `Refund` model), recompute balance in a transaction, and audit the change.
- **Effort:** M
- **Confidence:** Confirmed.

### [BILL-010] Manual payments have no idempotency key
- **Severity:** P2
- **Area:** Duplicate prevention
- **Evidence:** `src/app/api/invoices/[id]/route.ts` (POST payment)
- **Problem:** The serializable transaction recomputes the balance, but two different manual submissions of the same check/cash payment can both succeed if they are under the balance (e.g., a double-click after the first commits).
- **Impact:** Duplicate payment rows and overstated revenue.
- **Reproduce / verify:** Submit the same payment twice with a short delay.
- **Recommended fix:** Add a client-generated idempotency key (or unique `reference` per invoice/method) and reject duplicates.
- **Effort:** S
- **Confidence:** Likely.

### [BILL-011] Invoice status filter accepted arbitrary strings
- **Severity:** P2
- **Area:** Error handling
- **Evidence:** `src/app/api/invoices/route.ts:14`
- **Problem:** `status` was passed directly to Prisma; an invalid value produced a 500.
- **Impact:** Noisy errors and poor UX from stale links.
- **Recommended fix:** Validate against `InvoiceStatus`; return `400` with the allowed values.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [BILL-012] Quote approval was not race-safe
- **Severity:** P2
- **Area:** Contract integrity
- **Evidence:** `src/app/api/approve/[token]/route.ts` (POST)
- **Problem:** Two concurrent approvals could both read `SENT` and create duplicate signatures; expired `validUntil` was not enforced.
- **Impact:** Duplicate signatures and approvals after expiry.
- **Reproduce / verify:** Send two simultaneous approve requests with the same token.
- **Recommended fix:** Re-check status inside a serializable transaction; enforce `validUntil`; return `409`/`410`.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [BILL-013] Deposit fields are never collected
- **Severity:** P2
- **Area:** Workflow
- **Evidence:** `prisma/schema.prisma` (`Quote.depositRequired`, `depositPaid`), quote UI
- **Problem:** A quote can require a deposit, but there is no deposit payment flow, no balance adjustment, and no gate before work starts.
- **Impact:** Shops cannot enforce deposits; the fields mislead staff.
- **Recommended fix:** Add a deposit checkout/payment intent, apply it to the invoice balance, and show deposit status on the quote/job.
- **Effort:** M
- **Confidence:** Confirmed.

### [BILL-014] PDF auto-prints and has no meaningful filename
- **Severity:** P3
- **Area:** UX
- **Evidence:** `src/lib/pdf.ts`
- **Problem:** The generated document triggers print behavior and does not set a customer-friendly download filename.
- **Impact:** Extra steps on mobile; files saved as generic names.
- **Recommended fix:** Provide a download action with `invoice-<number>.pdf` and make printing explicit.
- **Effort:** S
- **Confidence:** Confirmed.

### [BILL-015] Quote approval could still race a late expiry
- **Severity:** P2
- **Area:** Quote state integrity
- **Evidence:** `src/app/api/approve/[token]/route.ts` (GET/POST)
- **Problem:** The approval transaction re-checked status but not `validUntil`, and the GET expiry path used an unconditional update. A GET that expired the quote could overwrite a concurrent approval, or a POST that passed the pre-check could approve a quote that expired before the transaction read it.
- **Impact:** An expired estimate could be approved, or a valid approval could be replaced with `EXPIRED`.
- **Reproduce / verify:** Race an approval POST with a GET after `validUntil` passes.
- **Recommended fix:** Re-check `validUntil` inside the serializable transaction, only mark non-terminal quotes expired with `updateMany`, and map serialization failures to a refreshable 409.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [BILL-016] Any staff role could void or refund an invoice
- **Severity:** P2
- **Area:** Financial controls
- **Evidence:** `src/app/api/invoices/[id]/route.ts` (PATCH status)
- **Problem:** The invoice whitelist allowed `status: VOID|REFUNDED`, but only required a session. Service advisors and dispatchers could void/refund invoices even though payroll/reports are restricted.
- **Impact:** Revenue and receivables could be altered without accounting review.
- **Reproduce / verify:** As a service advisor, PATCH an invoice with `{ "status": "VOID" }`.
- **Recommended fix:** Restrict invoice void/refund status changes to `ADMIN` and `ACCOUNTANT`; keep descriptive edits available to staff.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

## What already works well
- Invoice totals, tax, discounts, and line items are recalculated server-side.
- Payment history displays method, reference, and received date.
- Stripe amounts come from the database, not the client.
- Quote approval supports signature capture and audit metadata.
- Invoice send now creates a customer portal token and a working link.
- PDF output is branded and includes payment history.

## Cross-section references
- Customer portal payment link: `05-customer-portal-public.md` / PORT-010.
- Payment display type: `14-workflow-e2e.md` / FLOW-010.
- Refund/reporting: `08-reports-payroll-accounting.md` / FIN-004.

## Verification commands / limitations
- `npm run type-check`, `npm run lint`, `npm test -- --run` — clean on the merged tree (4 files / 14 tests, including the Stripe webhook test).
- Stripe webhook end-to-end cannot be verified without `STRIPE_SECRET_KEY` and a webhook signing secret.
- No refund/void runtime test exists because the workflow is not implemented.
