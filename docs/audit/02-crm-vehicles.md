# 02 — CRM, Customers & Vehicles Audit

## Verdict
**Ship with fixes.** Customer and vehicle CRUD works and the prior inline-create/edit flows are usable. The main integrity gaps were mass assignment and the lack of a customer/vehicle relationship check when creating a job; both are fixed. The larger remaining gap is tenant scoping and duplicate/claim workflows for customer records.

## Scorecard
| Dimension | Grade | Notes |
|---|---|---|
| Correctness | B | Core CRUD works; job creation now validates vehicle ownership. |
| Security & tenant isolation | C | No shop scoping; customer PII is global to staff. |
| Data integrity | B | Whitelists and relation checks added; no customer merge/dedupe. |
| Error handling | B | Validation errors are returned; some FK errors still become 500s. |
| UX & accessibility | B- | Inline create/edit exists; New Job customer picker is still a long select. |
| Performance | C | List endpoints are paginated but some pages fetch 200 records. |
| Maintainability | B | Zod schemas are clear; repeated address/phone rules could be shared. |

## Coverage matrix
| Item | Type | Result | Notes |
|---|---|---|---|
| `/customers` list/search/create | Page/API | PASS | Pagination clamped; whitelist on create. |
| `/customers/[id]` detail/edit | Page/API | PASS | Customer PATCH whitelisted. |
| Inline “Add customer” from New Job | UI/API | PASS | Real customer is created and selected. |
| `/vehicles` list/create/edit | Page/API | PASS | Vehicle PATCH whitelisted. |
| Vehicle combobox (year/make/model) | UI | PASS | Type-ahead and free entry work. |
| New Job customer/vehicle selection | UI/API | PASS | Vehicle must belong to selected customer. |
| Fleet accounts/rates | Page/API | PASS | Mutations whitelisted. |
| Customer CSV/JSON export | API | PASS | Internal `unitCost` removed. |
| Customer account claim | Auth/CRM | FAIL | Existing customers cannot self-claim safely; staff activation needed. |
| Duplicate detection/merge | CRM | FAIL | No merge workflow. |
| Tenant isolation | Data | FAIL | See AUTH-010 / DATA-001. |

## Findings

### [CRM-001] Customer PATCH accepted arbitrary fields
- **Severity:** P1
- **Area:** Mass assignment
- **Evidence:** `src/app/api/customers/[id]/route.ts`
- **Problem:** The PATCH handler spread the request body into `prisma.customer.update`, allowing callers to set fields the UI never exposes, including `portalToken`, `isActive`, and internal flags.
- **Impact:** Staff could accidentally or maliciously overwrite account state; a leaked token could be rotated to a known value.
- **Reproduce / verify:** PATCH a customer with `{ "portalToken": "known-value", "isActive": false }`.
- **Recommended fix:** Parse a strict Zod schema and build an explicit update object.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [CRM-002] Vehicle PATCH accepted arbitrary fields
- **Severity:** P1
- **Area:** Mass assignment
- **Evidence:** `src/app/api/vehicles/[id]/route.ts`
- **Problem:** Vehicle updates spread the body, allowing `customerId` reassignment and internal fields to be changed without validation.
- **Impact:** A vehicle could be silently moved to another customer, breaking service history and invoices.
- **Reproduce / verify:** PATCH `{ "customerId": "<other-customer>" }`.
- **Recommended fix:** Whitelist editable vehicle fields; require an explicit transfer action for `customerId`.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [CRM-003] Job could link a customer to another customer’s vehicle
- **Severity:** P1
- **Area:** Relational integrity
- **Evidence:** `src/app/api/jobs/route.ts` (POST)
- **Problem:** Job creation accepted `customerId` and `vehicleId` independently. A typo or crafted request created a job showing customer A with customer B’s car.
- **Impact:** Wrong vehicle on estimates, invoices, inspections, and service history.
- **Reproduce / verify:** POST a job with a valid customer and a vehicle belonging to a different customer.
- **Recommended fix:** Fetch both records and require `vehicle.customerId === customer.id`; verify the technician is active and has a technician/admin role.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [CRM-004] No shop/tenant scoping on customer and vehicle reads
- **Severity:** P1
- **Area:** Tenant isolation
- **Evidence:** `src/app/api/customers/route.ts:27`, `src/app/api/vehicles/route.ts`
- **Problem:** Lists and detail lookups do not filter by the session’s shop. `User.shopId` exists, but customer/vehicle models have no shop relation.
- **Impact:** Any staff account can search and read every shop’s customers and vehicles.
- **Reproduce / verify:** Create records under two shops; query as a user from shop B.
- **Recommended fix:** Add `shopId` to `Customer` and `Vehicle`, backfill, enforce it in every query, and add composite indexes.
- **Effort:** L
- **Confidence:** Confirmed.

### [CRM-005] Customer export exposed internal parts cost
- **Severity:** P2
- **Area:** Privacy / margin data
- **Evidence:** `src/app/api/customer/export/route.ts:31`
- **Problem:** The CCPA/data export included `unitCost` for parts, which is internal shop margin data.
- **Impact:** Customers could infer vendor cost and shop markup.
- **Reproduce / verify:** Download `/api/customer/export` as a customer and inspect `parts[].unitCost`.
- **Recommended fix:** Export only customer-facing fields; keep `unitCost` internal.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [CRM-006] Customer list limit was unbounded
- **Severity:** P2
- **Area:** Performance / DoS
- **Evidence:** `src/app/api/customers/route.ts:31`
- **Problem:** `limit` was parsed directly, so `?limit=1000000` could force a huge query and JSON payload.
- **Impact:** Memory/latency spikes and easy resource exhaustion.
- **Reproduce / verify:** Request `GET /api/customers?limit=1000000`.
- **Recommended fix:** Clamp `page` and `limit` (customers max 200, other lists max 100).
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [CRM-007] New Job customer picker is a long, non-searchable select
- **Severity:** P2
- **Area:** UX
- **Evidence:** `src/app/(dashboard)/jobs/new/page.tsx:40`
- **Problem:** The page fetches `/api/customers?limit=200` and renders a plain `Select`. Once a shop has hundreds of customers, staff must scroll and cannot search by phone, plate, or VIN.
- **Impact:** Slow job intake and wrong-customer selection.
- **Reproduce / verify:** Seed 300 customers and try to find one by phone in New Job.
- **Recommended fix:** Use the existing combobox pattern with server-side search (`q`), or add a customer search input that queries `/api/customers?search=`.
- **Effort:** M
- **Confidence:** Confirmed.

### [CRM-008] No duplicate-customer detection or merge
- **Severity:** P2
- **Area:** Data quality
- **Evidence:** `src/app/api/customers/route.ts` (create), no merge route
- **Problem:** Customer creation does not check phone/email for an existing active customer, and there is no merge workflow.
- **Impact:** Duplicate customers split service history, invoices, and marketing consent.
- **Reproduce / verify:** Create two customers with the same phone and email.
- **Recommended fix:** Warn on matching phone/email, offer “use existing”, and add an admin merge that re-points vehicles/jobs/invoices and archives the duplicate.
- **Effort:** M
- **Confidence:** Confirmed.

### [CRM-009] CCPA deletion request is email-only, with no tracked workflow
- **Severity:** P2
- **Area:** Privacy operations
- **Evidence:** `src/app/api/customer/delete-request/route.ts`
- **Problem:** The endpoint emails the admin but creates no durable request record, SLA timer, or status. If email is misconfigured it now fails honestly, but there is still no in-app queue.
- **Impact:** Deletion requests can be lost; no audit trail for compliance.
- **Reproduce / verify:** Submit a request, then search for a corresponding database row — none exists.
- **Recommended fix:** Add a `PrivacyRequest` model with status, timestamps, and admin actions; optionally email a confirmation.
- **Effort:** M
- **Confidence:** Confirmed.

### [CRM-010] Customer dashboard reported only the 10 recent jobs as total
- **Severity:** P3
- **Area:** Incorrect stat
- **Evidence:** `src/app/api/customer/dashboard/route.ts:65`
- **Problem:** `totalJobs` used `recentJobs.length`, and `recentJobs` is capped at 10.
- **Impact:** Customers with more than 10 jobs see a wrong lifetime count.
- **Reproduce / verify:** Seed 12 jobs and open `/customer`.
- **Recommended fix:** Use `prisma.job.count({ where: { customerId } })`.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [CRM-011] VIN is free text and not validated or decoded
- **Severity:** P2
- **Area:** Vehicle data quality
- **Evidence:** `src/app/api/vehicles/route.ts` (VIN field), vehicle form
- **Problem:** VIN accepts any string; no 17-character check, no check-digit validation, and no decode-to-year/make/model.
- **Impact:** Wrong vehicle identity, failed parts lookup, bad CARFAX/history matching.
- **Reproduce / verify:** Save a 5-character VIN.
- **Recommended fix:** Normalize uppercase, require 17 chars for VIN, validate the check digit where applicable, and offer NHTSA decode.
- **Effort:** M
- **Confidence:** Confirmed.

### [CRM-012] Fleet rates and shop records were mass-assignable
- **Severity:** P2
- **Area:** Mass assignment
- **Evidence:** `src/app/api/fleet/route.ts`, `src/app/api/shops/route.ts`
- **Problem:** Fleet and shop mutations previously spread request bodies; a caller could set internal pricing or shop ownership fields.
- **Impact:** Wrong billing rates and cross-shop configuration changes.
- **Reproduce / verify:** PATCH a fleet account with an unexposed field.
- **Recommended fix:** Strict whitelists (already added) and role checks (`ADMIN` for shop mutations).
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

## What already works well
- Inline customer creation from New Job is real and selects the new record.
- Customer edit, vehicle add, and vehicle type-ahead work on mobile.
- Customer export/delete endpoints are scoped to the logged-in customer.
- Soft-delete (`isActive`) is used instead of hard-deleting customers/vehicles.

## Cross-section references
- Account takeover: `01-auth-security.md` / AUTH-002.
- Tenant isolation: `10-database-data-integrity.md` / DATA-001.
- Job relation validation: `03-jobs-dispatch-tech.md` / JOBS-003.

## Verification commands / limitations
- `npm run type-check`, `npm run lint`, `npm test -- --run` — clean.
- No live multi-shop seed exists, so tenant isolation is confirmed by code inspection only.
- VIN decode/NHTSA behavior is unverified without a runtime key.
