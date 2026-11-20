# Triple-check — daily-use readiness (2026-11-19)

Environment: production build (`next build && next start`) against the migrated
local Postgres (`bvauto_audit`), plus the live Vercel deployment and the
published Android 1.7 APK. Admin, technician, customer, and unauthenticated
sessions were exercised with a real browser.

## Automated gates

| Gate | Result |
| --- | --- |
| `npm run type-check` | PASS |
| `npm run lint` | PASS |
| `npx vitest run` | PASS — 28 files / 119 tests |
| `npm run build` | PASS after retrying past the Next.js security advisory |

## Verified working

- **Auth / roles** — admin, technician, customer, and public sessions; customer
  pages redirect to `/customer`; staff APIs return 403 for customers; technician
  financial/admin pages redirect to `/tech` and block payroll/invoice/report APIs.
  Technician part costs and customer financials are redacted.
- **Customers / vehicles** — create customer with only first name + phone, phone
  formatting, customer search, vehicle add with VIN/make/model pickers, owner
  assignment, vehicle detail and service history.
- **Jobs** — new job with customer-filtered vehicle list, technician picker
  including admin/owner + technicians, mileage-in, job detail, status transitions
  (invalid transitions rejected), time clock in/out, notes, photos, DVI.
- **Quotes / tax** — build labor + part quote, 40% default parts markup, parts-only
  10.5% tax (`$100 labor + $70 parts = $7.35 tax / $177.35 total`), save, approve,
  convert to invoice, duplicate-invoice guard.
- **Invoices / payments / PDF** — invoice detail, mileage, payments-received list,
  partial payment → PARTIAL, final payment → PAID, payment history, refund →
  PARTIAL with negative row, overpayment rejected, payment plan (3 installments)
  and installment "Mark Paid", real PDF (`%PDF-`, 1 page) with branding, vehicle,
  mileage, parts-only tax, payments and thank-you footer.
- **Portal / public** — portal token links, active-job banner, invoices/Pay Now
  graceful Stripe fallback, portal message thread, public booking, service-request
  schedule → customer/vehicle/job creation → request marked SCHEDULED, estimate
  approval page (valid/already-approved/invalid token), tracking page, review page,
  privacy/terms, manifest/sw/robots/sitemap.
- **Parts / inventory** — add job part (cost/markup/price/status), vendor, purchase
  order create → SENT → RECEIVED (marks job part received), inventory item with
  opening stock, stock +/- and movement history.
- **Financial admin** — payroll estimate from actual time logs ($30/hr × 10 min =
  $5.00), payroll CSV, reports KPIs + date range, invoice CSV export, pipeline.
- **Settings / growth** — shop edit (address/phone/email/tax/markup), team member
  create, TOTP setup/cancel, marketing campaign create/send (clear "Twilio not
  configured" toast), notifications, audit log, global search.
- **Mobile** — 390×844: no horizontal overflow on dashboard, jobs, new job,
  invoices, invoice detail, customers, vehicles, settings, shop board, schedule,
  dispatch, reports, payroll, parts, inventory, guide; dialogs scroll and fit.
- **Android 1.7** — live `/api/app-version` returns build 8/1.7/reinstall-below 8;
  production APK hash `ca6c5a25…e6b`, signer `8e313beb…f34e`, `captureInput:false`.

## Bugs found and fixed

1. **Technician DVI submit/send hidden behind bottom navigation.** On
   `/tech/jobs/[id]/inspection`, the fixed action bar sat at `bottom-0` under the
   role's fixed 64px nav, which intercepted clicks. "Complete Inspection" and
   "Send to Customer" could not be tapped. Fixed by offsetting both bars above the
   nav and increasing page bottom padding. Re-verified at 390×844 and 1280×900
   with real clicks.
2. **Quote approval link blocked when email/SMS is unconfigured.** The Send API
   returned 503/502 before creating `approvalToken`, although the quote UI already
   supports copying the approval link for manual delivery. Production has no
   Resend/Twilio keys, so quotes could not be sent for approval at all. The API
   now mints the token, marks the quote SENT, and returns the approval URL plus
   per-channel statuses; the UI copies the link and warns that delivery did not
   happen.
3. **No account recovery without email.** Settings → Team Members now has a
   **Reset** action that issues a one-time temporary password, invalidates the
   member's old sessions, and writes an audit entry. This works without Resend.
4. **Portal message endpoint 500 on bad input.** A non-string `body` now returns
   `400 {"error":"Message required"}` instead of crashing.
5. **Production timezone was Los Angeles.** `SHOP_TIMEZONE` and
   `NEXT_PUBLIC_SHOP_TIMEZONE` are now `America/Chicago` for the Houston shop, so
   “today”, date ranges, and printed dates no longer drift by two hours.
6. **Security upgrade.** Next 16.4.3 → 16.4.6, Prisma 7.10.1, Electron 44.11.5,
   Vite 8.3.8, Vitest 5.1.1; audit findings dropped from 29 (5 high) to 6
   moderate dev-only packaging issues. See
   `docs/audit/status/dependency-upgrade-2026-11-19.md`.
7. **Codemagic signing.** The release key is now stored in the restricted
   `android_release_signing` variable group and both Android workflows decode it
   at build time. `android-signing-verify` was added to test the signing path
   without publishing an APK.

## Production configuration findings

`vercel env ls --project bv-auto --environment production` shows these are set:
`DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `CRON_SECRET`,
`ANTHROPIC_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `SHOP_NOTIFY_PHONE`,
`GOOGLE_REVIEW_URL`, `STAFF_INVITE_CODE`, `NEXT_PUBLIC_APP_NAME`.

These are **not set**, so the related features degrade to clear "not configured"
messages instead of working:

- `RESEND_API_KEY` — invoice/quote/review email delivery
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` — SMS,
  text-to-pay, review/marketing/sequence sends
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — online payments, text-to-pay,
  quote deposits, subscription billing
- `PARTSTECH_*` — live supplier parts search

Photo upload does not need `BLOB_READ_WRITE_TOKEN`: it falls back to storing bytes
in Postgres and serving them through `/api/photos/[id]`.

## Deployment

Final commit `7e32394` contains the fixes and these reports. Vercel production
deployment `bv-auto-45hq3xoyi` is Ready, and
`https://bv-auto.vercel.app/api/app-version` still serves build 8 / 1.7 /
reinstall-below 8 / APK hash `ca6c5a25…e6b`. These are webview fixes, so the
installed Android app receives them without a new APK.

Dependency and CI follow-ups are recorded in
`docs/audit/status/dependency-upgrade-2026-11-19.md`.

## Still unverified (needs a real device / real provider)

- Installing 1.7 over an existing install and the one-time uninstall flow on a
  physical Android device or emulator.
- A real Resend email, Twilio SMS, or Stripe checkout/refund round-trip.
- Codemagic builds: the new keystore still needs to be uploaded as
  `bvauto_keystore` (alias `bvauto`). The current 1.7 APK was built and published
  locally, so users can update without CI.
- Devin org secrets still contain the old release key; future Devin builds would
  be signed with the obsolete key until they are replaced.
