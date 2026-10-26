# Fix Plan — Deduplicated, Batched

This plan is ordered by risk and dependency, not by section number. Items marked **DONE** were changed and verified by type-check, lint, tests, and build in this pass. Items marked **OPEN** are still in the codebase.

Per-PR status notes for fixes made after this plan live in [`status/`](status/) (one file per fix PR, so parallel PRs don't conflict here).

## Phase 0 — Critical security and money truthfulness (DONE)
| ID | Fix | Files | Verification |
|---|---|---|---|
| AUTH-001 | Default-deny proxy; customer/tech allowlists | `src/proxy.ts` | Role matrix inspection; type-check |
| AUTH-002 | Stop auto-linking existing customers by unverified email | `src/app/api/auth/register/route.ts` | 409 path; type-check |
| AUTH-003 | Booking GET staff-only | `src/app/api/booking/route.ts`, `src/proxy.ts` | Proxy + route check |
| AUTH-004 | Portal token creation staff-only | `src/app/api/portal/[token]/route.ts` | Role check |
| AUTH-005 | Block tech financial/admin APIs/pages | `src/proxy.ts` | Proxy inspection |
| AUTH-006 | Cron routes fail closed when secret unset | `src/app/api/cron/*/route.ts` | Code inspection |
| AUTH-007 | Twilio signature validation + dedupe | `src/app/api/sms/webhook/route.ts` | Type-check |
| AUTH-008 | Tech job ownership + scoped clock-out | `src/app/api/jobs/[id]/**` | Type-check |
| BILL-001 | Stripe paid-only, dedupe, serializable, balance-aware | `src/app/api/stripe/webhook/route.ts` | Unit test |
| BILL-002 | Manual payment overpay/void guards | `src/app/api/invoices/[id]/route.ts` | Type-check |
| BILL-003 | Require approved quote before invoice | `src/app/api/invoices/route.ts` | Type-check |
| BILL-004 | Invoice send only marks SENT on real delivery; portal token | `src/app/api/invoices/[id]/send/route.ts` | Type-check |
| BILL-005 | Text-to-pay requires Stripe + SMS | `src/app/api/invoices/[id]/text-to-pay/route.ts` | Type-check |
| BILL-006 | Escape invoice PDF fields | `src/lib/pdf.ts` | Type-check |
| BILL-007 | Payment-plan ownership/amount validation | `src/app/api/invoices/[id]/payment-plan/route.ts` | Type-check |
| BILL-012 | Quote approval expiry + serializable re-check | `src/app/api/approve/[token]/route.ts` | Type-check |
| COMM-001–006 | No fake quote/review/reset/text-to-pay/SMS success | `src/app/api/**`, `src/lib/email.ts`, `src/lib/sms.ts` | Type-check |
| COMM-010 | Escape email/inspection HTML | `src/lib/email.ts` | Type-check |
| PORT-001–003 | Portal/token/tracking fixes | `src/proxy.ts`, `src/app/api/portal/**`, `src/app/api/tracking/**` | Type-check |
| PORT-006 | Portal message rate limit/length | `src/app/api/portal/[token]/message/route.ts` | Type-check |
| PORT-009–010 | Real shop phone; real review URL | `src/app/(customer)/layout.tsx`, `src/app/api/review/[token]/route.ts` | Type-check |
| PLAT-001 | Remove authenticated API caching | `public/sw.js` | Build |
| PLAT-002 | Electron exact-origin check | `electron/main.js` | Code inspection |
| PLAT-010 | Clear cache on sign-out | `src/lib/sign-out.ts`, layouts/sidebar | Type-check |
| PLAT-013 | Allow Vercel Analytics/Speed Insights in CSP | `next.config.ts` | Browser console clean |
| FIN-003 | Neutralize CSV formula injection in payroll export | `src/app/api/payroll/route.ts` | Type-check |
| FIN-004 | Use collected `amountPaid` for customer/tech/GP revenue | `src/app/api/reports/route.ts` | Type-check |
| FIN-012 | Fix reports conversion metric field names | `src/app/(dashboard)/reports/page.tsx` | Mobile reports render |
| UX-013 | Hide push prompt on public pages | `src/components/push-notification-setup.tsx`, `src/app/layout.tsx` | Mobile `/book` render |
| JOBS-004 | Real inspection email + escaping | `src/app/api/jobs/[id]/inspection/send/route.ts` | Type-check |
| JOBS-013 | Tech job list filter + insurance/sublet role/ownership | `src/app/api/jobs/route.ts`, `src/app/api/jobs/[id]/insurance/route.ts` | Type-check |
| JOBS-014 | Validate reassignment target is active technician | `src/app/api/jobs/[id]/route.ts` | Type-check |
| JOBS-015 | Scope photo deletion to the assigned technician | `src/app/api/jobs/[id]/photos/route.ts` | Type-check |
| BILL-015 | Re-check quote expiry inside serializable approval | `src/app/api/approve/[token]/route.ts` | Type-check |
| BILL-016 | Restrict invoice void/refund to admin/accounting | `src/app/api/invoices/[id]/route.ts` | Type-check |
| COMM-014 | Create portal token for overdue reminder links | `src/app/api/cron/overdue/route.ts` | Type-check |
| COMM-015 | Escape customer name in review email | `src/app/api/cron/reviews/route.ts` | Type-check |
| AI-011 | Clamp negative AI estimate values | `src/app/api/ai/estimate/route.ts` | Type-check |
| AI-012 | Instantiate Anthropic client inside photo-analysis handler | `src/app/api/jobs/[id]/photos/analyze/route.ts` | Type-check |
| PART-011 | Block technician edits to part pricing fields | `src/app/api/parts/[id]/route.ts` | Type-check |
| JOBS-006 | Shop-timezone day/week/month + local datetime → ISO | `src/lib/timezone.ts`, dashboard/notifications/jobs-new | Type-check |
| AI-001 | Coerce/recompute AI estimate numbers | `src/app/api/ai/estimate/route.ts` | Type-check |
| AI-002 | AI diagnosis job ownership | `src/app/api/ai/diagnose/route.ts` | Type-check |
| CRM-003/JOBS-003 | Vehicle must belong to customer | `src/app/api/jobs/route.ts` | Type-check |
| CRM-005 | Remove internal `unitCost` from customer export | `src/app/api/customer/export/route.ts` | Type-check |
| DATA-008/PLAT-010 | Sign-out clears cache (queue scoping remains OPEN) | `src/lib/sign-out.ts` | Type-check |

## Status updates — inventory (branch `devin/*-inventory-ledger`)

Fixed in code, with unit tests in `src/__tests__/inventory.test.ts`:

- **PART-004 / FLOW-005**: append-only `InventoryMovement` ledger (`INITIAL/RECEIVE/ISSUE/RETURN/ADJUST`, signed quantity, `balanceAfter`, user, job/part/PO links). `quantityOnHand` can no longer be set directly; stock changes go through `moveStock()` in `src/lib/inventory.ts` (adjustment or physical count, with reason). Existing prod stock was given an `INITIAL` opening-balance row. Inventory items show a stock history.
- **PART-005**: stock can never go negative (conditional decrement; 409 on shortfall). A part linked to an inventory item (`JobPart.inventoryItemId`) is issued from stock once when INSTALLED and returned when RETURNED/CANCELLED/deleted.
- **PO receiving**: `POST /api/purchase-orders/[id]/receive` records partial receipts per line (`JobPart.quantityReceived`). The PO becomes RECEIVED only when every line is in, and PO status changes follow a transition table (no receiving a cancelled PO, no reopening a received one).
- **PART-002 / PART-006 (partial)**: vendors must exist and be active, markup is bounded to 0–500%, and costs, prices and quantities are non-negative and bounded.

## Status updates — communications consent and booking (branch `devin/*-comms-consent`)

Fixed in code, with unit tests in `src/__tests__/consent.test.ts`:

- **COMM-008**: the Twilio webhook parses STOP/STOPALL/UNSUBSCRIBE/CANCEL/END/QUIT (opt out), START/UNSTOP/YES (opt back in) and HELP/INFO (TwiML help reply). Consent is stored on every customer sharing that number (`Customer.smsOptOut`, `smsOptOutAt`). `lib/sms.ts send()` and the staff text box refuse to text an opted-out number. Staff can record an opt-out but cannot clear one; only the customer's START does that.
- **COMM-011**: new `Customer.marketingOptOut` ("Do not market" on the customer page). Campaign audiences (`marketableSms`), SMS sequences, review-request SMS/email and maintenance-reminder SMS all skip opted-out customers.
- **PORT-011 / FLOW-003**: a public booking now sends a confirmation SMS and/or email (best-effort, so a provider failure never loses the booking), creates an in-app notification plus a push for ADMIN/DISPATCHER/SERVICE_ADVISOR users, and shows the customer a `BR-XXXXXX` reference.
- Not exercised against live Twilio/Resend (no keys in this environment).

## Phase 1 — P1 workflow/data integrity (OPEN)
| ID | Fix | Why now | Effort | Files |
|---|---|---|---|---|
| AUTH-010/DATA-001 | Add `shopId` to tenant models, backfill, enforce query helper | Only remaining P0 for multi-shop | L | `prisma/schema.prisma`, all API routes |
| BILL-009 | Refund/credit model and reversal transaction | Revenue is wrong after refunds | M | payments/invoices |
| BILL-013/FLOW-006 | Deposit checkout + balance application | Protects special-order work | M | quote/invoice/Stripe |
| PART-004/PART-005 | PO receiving + inventory movement ledger | Stock and job cost drift | M | parts/PO/inventory |
| COMM-008/COMM-011 | STOP/START consent + campaign suppression | TCPA/compliance | M | SMS webhook, marketing |
| FIN-006 | Payroll run snapshot + period lock | Historical pay integrity | L | payroll |
| PLAT-003 | Add `master` to CI triggers/deploy condition | Pushes currently bypass CI | S | `.github/workflows/ci.yml` |
| PLAT-004 | Baseline `prisma/migrations` and use `migrate deploy` | Production schema safety | M | `prisma/migrations` |
| FLOW-003/PORT-011 | Booking confirmation + staff alert | Leads go stale | M | booking, notifications |
| QUAL-001–003 | Authz table tests + Playwright smoke + money tests | Prevent regressions | L | `src/__tests__`, e2e |
| BILL-008 | Refresh expired Stripe Checkout sessions | Customer pay link breaks | S | `invoices/[id]/collect` |
| BILL-010 | Manual payment idempotency key | Double-submit duplicates | S | invoice payment route |
| PLAT-007 | Release keystore + signed APK | In-place updates fail | M | Android build |

## Phase 2 — P2 UX, workflow, and integration quality (OPEN)
| ID | Fix | Effort | Files |
|---|---|---|---|
| UX-001 | Searchable customer combobox in New Job | M | `jobs/new`, customers API |
| UX-002/UX-003 | Shared `MoneyInput`/`TextField` with `inputMode`, step, autocaps/autocorrect | M | all forms |
| UX-004/UX-006 | Toast-based mutation errors with retry | M | shared mutation wrapper |
| UX-007/FLOW-010 | Payment `type` + running balance in history | S | invoice detail |
| UX-008 | Mobile card layouts for wide tables | M | payroll/reports/invoices/inventory |
| UX-010 | aria labels/labels/focus rings | M | components |
| UX-011 | Format all dates in shop timezone | S | date helpers |
| UX-012/FLOW-011 | Portal “Pay now” button | M | portal, Stripe |
| CRM-007/CRM-008 | Customer search + duplicate merge | M | CRM |
| CRM-011 | VIN validation/decode | M | vehicles |
| JOBS-005 | Status transition matrix | M | jobs |
| JOBS-010/DATA-005 | Concurrency-safe document numbers | S | `lib/utils` |
| JOBS-012 | Audit notes/timelog/photos/signatures | S | job subroutes |
| PART-002/PART-003 | Vendor/PO whitelists + shop scope | M | vendors/POs |
| PART-006 | Markup/price bounds | S | parts |
| COMM-009 | Resend/Twilio delivery status callbacks | M | webhooks |
| COMM-012 | Shared rate limiter | M | `lib/rate-limit` |
| AI-003–AI-008 | Model envs, JSON schema, prompt delimiting, PII redaction, cost quota, safe errors | M | AI routes |
| FIN-005/FIN-008/FIN-009 | Shop filter, money math, time windows | M | reports/payroll |
| PLAT-005 | Nonce/hash CSP; remove `unsafe-eval` | M | `next.config.ts` |
| PLAT-006 | Redis/KV rate limits/idempotency | M | infra |
| PLAT-008 | Neon `DATABASE_URL` + production schema push/migration | S | `.env`/deploy |
| PLAT-009 | Verify Sentry DSN/alerts | S | Vercel/Sentry |
| PLAT-011 | Backup/PITR + restore drill | S | ops |
| QUAL-004–QUAL-010 | Error wrapper, validation rule, error boundaries, OpenAPI, dependency audit | M | app-wide |

## Phase 3 — P3 polish (OPEN)
- FLOW-012 supplemental quotes / mid-job approvals.
- FLOW-009 cancellation/no-show reasons and fees.
- FIN-010 owner inclusion independent of role.
- FIN-011 overtime/burden/reimbursement.
- DATA-010 audit-log PII retention.
- PLAT-012 build-injected service-worker cache version.
- QUAL-007 delete offline dead code; QUAL-008 fix Vitest CJS warning.
- PART-009 vendor price history; PART-010 reorder automation.
- PORT-012 review-click bot filtering.
- BILL-014 PDF filename/explicit print.

## Dependency order
1. **Tenant scoping design** before any second shop or shop-scoped report work.
2. **Migrations baseline** before production schema changes.
3. **Refund model** before revenue-report rewrite (otherwise reports change twice).
4. **Inventory ledger** before PO receiving UI.
5. **Consent model** before marketing campaigns.
6. **Payroll snapshot** before payroll export is treated as authoritative.
7. **Authz tests** immediately after Phase 0 so the fixes stay fixed.

## Verification gate for every batch
```bash
npx prisma validate
npm run type-check
npm run lint
npm test -- --run
npm run build
```
For money/authz changes, add:
```bash
npm test -- --run --reporter=verbose
```
For mobile/UI changes, verify at a 390×844 viewport and one physical device.

## Blocked items
| Item | Blocker | Unblock action |
|---|---|---|
| Production `db:push`/migration | No Neon `DATABASE_URL` in `.env` | Add pooled + unpooled URLs |
| Live Stripe webhook/checkout | No `STRIPE_SECRET_KEY`/webhook secret | Add test-mode keys and run `stripe listen` |
| Live email/SMS | No `RESEND_API_KEY`/`TWILIO_*` | Add keys and verified sender/number |
| Live AI | No `ANTHROPIC_API_KEY` | Add key and confirm model IDs |
| Parts availability/ordering | No `PARTSTECH_*` | Add provider credentials |
| APK in-place update | Debug signing key mismatch | Create release keystore; one-time uninstall/reinstall |
| Subagent fix workspaces | OpenRouter key exhausted | Restore key or run lanes sequentially |


## Status updates

### Money integrity (branch `devin/*-money-integrity`)

Fixed in code, with unit tests in `src/__tests__/money.test.ts` (Stripe, card refunds and deposits not exercised against live Stripe):

- **DATA-006 / BILL-010**: `Payment.externalId` and `Payment.idempotencyKey` are unique in the DB. The Stripe webhook writes `externalId`; desk payments and refunds send a per-dialog idempotency key, and replays return the original row.
- **BILL-009 / FIN-009 (refunds)**: `POST /api/invoices/[id]/refund` (ADMIN/ACCOUNTANT) records a negative `REFUND` payment linked to the original, refunds card payments through Stripe first, and `src/lib/payments.ts#reconcileInvoice` recomputes paid/due/status (PAID → PARTIAL/REFUNDED, job PAID → INVOICED). Stripe `charge.refunded` webhooks are reconciled to Stripe's cumulative refunded amount. Revenue that sums `Payment.amount` is now net of refunds. VOID is blocked while money is still held; REFUNDED can no longer be set by hand.
- **BILL-013 / FLOW-006**: quote deposits are paid through the portal (`POST /api/portal/[token]/pay` with `quoteId`), recorded on the quote by the webhook, and carried onto the invoice as a `DEPOSIT` payment when the invoice is created (or applied right away if the invoice already exists).
- **BILL-008**: stored Checkout sessions are reused only while open, more than 10 minutes from expiry and priced at the current balance (`getReusableCheckoutUrl`).
- **UX-007 / FLOW-010**: invoice payment history shows payment type, balance after each row, and a Refund action.
- **UX-012 / FLOW-011**: portal "Pay Now" shows on every payable invoice and always opens a fresh, valid Checkout session.
- **FLOW-007**: overdue reminders are sent at most once per invoice per day (`lastReminderAt`, `reminderCount`), and link to the portal rather than a possibly expired Checkout URL.
