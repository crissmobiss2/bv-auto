# 12 — UX, Accessibility & Mobile Audit

## Verdict
**Ship with fixes.** The app is usable on a phone and the main shop/tech flows work, but input ergonomics and failure feedback are inconsistent. There are 39 `type="number"` inputs and zero explicit `inputMode="decimal"` declarations; only 14 fields set `autoCapitalize` and 3 set `autoCorrect`. A fake `tel:+1` link and silent mutation failures were fixed, but many screens still rely on `alert()` or show nothing when a write fails.

## Scorecard
| Dimension | Grade | Notes |
|---|---|---|
| Correctness | B | Main flows complete; some inputs fight mobile keyboards. |
| Security & tenant isolation | N/A | Covered in AUTH/DATA. |
| Data integrity | B | Validation errors are shown; no optimistic rollback in places. |
| Error handling | C+ | Key sends fixed; other mutations still silent. |
| UX & accessibility | C+ | Responsive, but labels/aria/input modes inconsistent. |
| Performance | B- | Heavy lists and large forms on mobile. |
| Maintainability | C+ | Repeated form patterns; no shared money/phone input. |

## Coverage matrix
| Item | Type | Result | Notes |
|---|---|---|---|
| Dashboard | Page | PASS | KPIs, today’s jobs, notifications. |
| Jobs list/new/detail | Page | PARTIAL | New Job customer picker long; money inputs. |
| Dispatch/pipeline | Page | PASS | Drag/drop works on desktop; touch is basic. |
| Tech job flow | Page | PASS | Large tap targets, sticky actions. |
| Invoices/quotes | Page | PARTIAL | Payment inputs and error toasts. |
| Customers/vehicles | Page | PASS | Inline create/edit. |
| Payroll/reports | Page | PASS | Tables scroll; export works. |
| Customer portal | Page | PARTIAL | No clear pay button. |
| Public booking/tracking | Page | PASS | Mobile-friendly. |
| Forms (all) | UI | FAIL | 39 number inputs, 0 decimal inputMode. |
| Error feedback | UI | PARTIAL | `alert()` and silent failures remain. |

## Findings

### [UX-001] New Job customer picker is not searchable
- **Severity:** P2
- **Area:** Intake speed
- **Evidence:** `src/app/(dashboard)/jobs/new/page.tsx:40`
- **Problem:** A plain `Select` loads up to 200 customers; no search by name, phone, plate, or VIN.
- **Impact:** Slow check-in and wrong-customer selection.
- **Recommended fix:** Use a searchable combobox backed by `/api/customers?search=`; keep inline “Add customer.”
- **Effort:** M
- **Confidence:** Confirmed.

### [UX-002] Money/decimal inputs do not request a decimal keyboard
- **Severity:** P2
- **Area:** Mobile input
- **Evidence:** 39 `type="number"` inputs; 0 `inputMode="decimal"` (repo scan)
- **Problem:** `type="number"` often shows a spinner and inconsistent keypad; currency fields lack `step="0.01"` and `inputMode="decimal"`.
- **Impact:** Hard to enter cents; accidental spinner changes; validation errors.
- **Recommended fix:** Create `MoneyInput`/`DecimalInput` with `inputMode="decimal"`, `step="0.01"`, `min="0"`, and string-backed state; replace currency fields.
- **Effort:** M
- **Confidence:** Confirmed.

### [UX-003] Autocapitalize/autocorrect coverage is inconsistent
- **Severity:** P2
- **Area:** Mobile input
- **Evidence:** 14 `autoCapitalize`, 3 `autoCorrect` across ~190 inputs (repo scan)
- **Problem:** Names/addresses need autocapitalize; emails/VINs/part numbers need autocorrect off; the current mix is ad hoc.
- **Impact:** Typo-prone data entry on phones.
- **Recommended fix:** Add shared `TextField` variants (`name`, `email`, `phone`, `vin`, `partNumber`, `money`) with the right attributes; migrate forms.
- **Effort:** M
- **Confidence:** Confirmed.

### [UX-004] Silent mutation failures on several screens
- **Severity:** P2
- **Area:** Error feedback
- **Evidence:** quote send (pre-fix), text-to-pay (pre-fix), inspection send (pre-fix), other `onError` handlers
- **Problem:** Some mutations have no `onError`; the button stops spinning and nothing tells the user why.
- **Impact:** Staff retry blindly or assume success.
- **Recommended fix:** Central mutation wrapper that shows a toast with the server’s `error` and a retry action; keep inline errors for forms.
- **Effort:** M
- **Confidence:** Confirmed — key sends fixed in this pass; broader pattern remains.

### [UX-005] Customer portal used a fake phone link
- **Severity:** P2
- **Area:** Trust
- **Evidence:** `src/app/(customer)/layout.tsx` (pre-fix)
- **Problem:** The phone icon linked to `tel:+1`.
- **Impact:** Tapping it dials an invalid number.
- **Recommended fix:** Fetch `/api/shop-info`, render the real number, hide if unset.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [UX-006] `alert()` is used for important failures
- **Severity:** P3
- **Area:** Feedback
- **Evidence:** quote send, text-to-pay, inspection send
- **Problem:** Browser alerts are blocking, ugly on mobile, and not accessible.
- **Impact:** Poor experience; easy to dismiss without reading.
- **Recommended fix:** Use the existing toast/dialog components with a persistent error and retry.
- **Effort:** S
- **Confidence:** Confirmed.

### [UX-007] Payment history lacks a payment-type label
- **Severity:** P2
- **Area:** Billing clarity
- **Evidence:** `src/app/(dashboard)/invoices/[id]/page.tsx:344`
- **Problem:** History shows method, reference, and date, but not whether a payment is a deposit, partial payment, final payment, or refund/credit. Split payments are hard to read.
- **Impact:** Staff/customer confusion about what remains.
- **Recommended fix:** Add a `type`/`kind` field (DEPOSIT/PARTIAL/FINAL/REFUND) and show amount, date, method, type, and remaining balance per row.
- **Effort:** S
- **Confidence:** Confirmed.

### [UX-008] Wide tables are not mobile-first
- **Severity:** P2
- **Area:** Responsive
- **Evidence:** payroll, reports, invoices, inventory tables
- **Problem:** Tables rely on horizontal scroll; key columns (balance, status) can be off-screen.
- **Impact:** Hard to use on a phone in the shop.
- **Recommended fix:** Card layout under `md`, sticky first column, and a “primary value” column.
- **Effort:** M
- **Confidence:** Confirmed.

### [UX-009] Empty/loading states are inconsistent
- **Severity:** P3
- **Area:** States
- **Evidence:** multiple pages
- **Problem:** Some pages show a spinner, some show blank content, some show a generic empty table.
- **Impact:** Users cannot tell “loading” from “no data.”
- **Recommended fix:** Shared `EmptyState`, `TableSkeleton`, and `ErrorState` components.
- **Effort:** S
- **Confidence:** Confirmed.

### [UX-010] Accessibility labels/aria are incomplete
- **Severity:** P2
- **Area:** Accessibility
- **Evidence:** icon-only buttons, inputs without `aria-label`/`htmlFor`
- **Problem:** Several icon buttons rely on `title` only; some inputs are not associated with labels.
- **Impact:** Screen-reader and keyboard users struggle.
- **Recommended fix:** Add `aria-label` to icon buttons, `htmlFor`/`id` to inputs, visible focus rings, and keyboard tests.
- **Effort:** M
- **Confidence:** Confirmed.

### [UX-011] Timezone display depends on the device
- **Severity:** P2
- **Area:** Scheduling
- **Evidence:** date formatting helpers, dashboard/schedule
- **Problem:** Server “today” now uses shop timezone, but client display uses the device timezone. A remote owner or traveling tech sees different times.
- **Impact:** Confusion about appointment times.
- **Recommended fix:** Format dates in `SHOP_TIMEZONE` explicitly and label the timezone; keep the device timezone only for “your local time” hints.
- **Effort:** S
- **Confidence:** Confirmed.

### [UX-012] Customer portal has no obvious “Pay now” action
- **Severity:** P2
- **Area:** Payments
- **Evidence:** `src/app/portal/[token]/page.tsx`
- **Problem:** Invoices are listed, but the portal does not present a clear Stripe checkout/pay button.
- **Impact:** Customers call the shop instead of paying online.
- **Recommended fix:** Add a “Pay balance” button per open invoice using `/api/stripe/checkout` or a portal-scoped checkout endpoint.
- **Effort:** M
- **Confidence:** Confirmed.

### [UX-013] Push-permission prompt appeared on public booking pages
- **Severity:** P2
- **Area:** Public UX / privacy
- **Evidence:** `src/components/push-notification-setup.tsx`, `src/app/layout.tsx` (root layout), mobile `/book` screenshot
- **Problem:** The root layout rendered the staff-style “Stay in the loop / Enable push notifications” prompt on public pages, including `/book`, and it covered form fields at a 390×844 viewport. It also requested notification permission from visitors who had no account.
- **Impact:** Intrusive public UX and an unnecessary permission prompt for leads.
- **Reproduce / verify:** Open `/book` on a phone-sized viewport; the prompt overlays the booking form.
- **Recommended fix:** Render the prompt only for authenticated sessions and hide it on public prefixes (`/book`, `/track`, `/portal`, `/approve`, `/review`, auth pages).
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

## What already works well
- Mobile layouts for the tech job flow, booking, tracking, and portal are usable.
- Inline customer/vehicle creation reduces context switching.
- Payment history and invoice totals are visible.
- Sticky headers and large tap targets on tech pages.
- The PWA install/update banner works.

## Cross-section references
- Payment types: `14-workflow-e2e.md` / FLOW-010.
- Portal payment: `05-customer-portal-public.md` / PORT-010.
- Timezone: `03-jobs-dispatch-tech.md` / JOBS-006.

## Verification commands / limitations
- `npm run type-check`, `npm run lint`, `npm test -- --run` — clean.
- Mobile checks were done at a phone viewport, not on physical iOS/Android hardware.
- Accessibility was inspected statically; no screen-reader or axe run was performed.
