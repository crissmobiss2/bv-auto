# 06 — Parts, Inventory, Vendors & Purchase Orders Audit

## Verdict
**Ship with fixes.** Parts catalog, job parts, vendor records, purchase orders, and the parts-only markup path exist and are usable. Parts PATCH mass assignment was fixed, and parts-only jobs now apply the configured markup. The section still lacks shop scoping, receiving reconciliation, and a real inventory movement ledger, so stock counts can drift.

## Scorecard
| Dimension | Grade | Notes |
|---|---|---|
| Correctness | B- | CRUD works; stock/status rules are loose. |
| Security & tenant isolation | C+ | Parts whitelist added; vendors/POs still broad. |
| Data integrity | C+ | No movement ledger; negative stock possible. |
| Error handling | B- | External parts API failures surface unevenly. |
| UX & accessibility | B- | Catalog and job parts are usable on mobile. |
| Performance | B- | Search is DB-backed; no obvious N+1 in lists. |
| Maintainability | B- | Parts logic is split across catalog, job parts, POs, and price book. |

## Coverage matrix
| Item | Type | Result | Notes |
|---|---|---|---|
| `/inventory` parts catalog | Page/API | PASS | Search/create/edit; whitelist added. |
| `/parts` / parts search | Page/API | PASS | External + local search. |
| Job parts add/edit/remove | API | PASS | Status and pricing. |
| Parts-only auto markup | Workflow | PASS | Applies configured markup. |
| `/vendors` | Page/API | PARTIAL | CRUD works; no strict whitelist/tenant scope. |
| `/purchase-orders` | Page/API | PARTIAL | Create/status works; no receiving reconciliation. |
| `/price-book` | Page/API | PARTIAL | Labor/parts pricing; no version history. |
| Inventory adjustments | API | FAIL | No movement ledger/negative guard. |
| Shop scoping | Data | FAIL | See DATA-001. |

## Findings

### [PART-001] Parts PATCH accepted arbitrary fields
- **Severity:** P1
- **Area:** Mass assignment
- **Evidence:** `src/app/api/parts/[id]/route.ts`
- **Problem:** The update handler spread the body into `prisma.part.update`, allowing changes to `shopId`, `createdAt`, cost, and other internal fields.
- **Impact:** Margin manipulation and cross-shop reassignment.
- **Reproduce / verify:** PATCH a part with `{ "shopId": "<other-shop>", "unitCost": 0 }`.
- **Recommended fix:** Strict Zod whitelist for editable catalog fields; admin-only for cost/shop changes.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [PART-002] Vendor and purchase-order mutations are not whitelisted
- **Severity:** P1
- **Area:** Mass assignment
- **Evidence:** `src/app/api/vendors/route.ts`, `src/app/api/vendors/[id]/route.ts`, `src/app/api/purchase-orders/route.ts`
- **Problem:** Vendor/PO create/update handlers still accept broad bodies; a caller can set internal fields, totals, or statuses the UI does not expose.
- **Impact:** Fake vendor terms, altered PO totals, and status jumps.
- **Reproduce / verify:** PATCH a vendor with an unexposed field; PATCH a PO to `RECEIVED` without receiving lines.
- **Recommended fix:** Add strict schemas, derive totals server-side, and restrict status changes to explicit actions (`send`, `receive`, `cancel`).
- **Effort:** M
- **Confidence:** Confirmed.

### [PART-003] No shop scoping on parts, vendors, or POs
- **Severity:** P2
- **Area:** Tenant isolation
- **Evidence:** `src/app/api/parts/route.ts`, `src/app/api/vendors/route.ts`, `src/app/api/purchase-orders/route.ts`
- **Problem:** All shops share one catalog/vendor/PO namespace.
- **Impact:** Cross-shop pricing and purchasing data exposure.
- **Recommended fix:** Add `shopId` and enforce it in every query; index `(shopId, partNumber)` and `(shopId, status)`.
- **Effort:** L
- **Confidence:** Confirmed.

### [PART-004] Purchase-order status can jump without line receiving
- **Severity:** P2
- **Area:** Inventory integrity
- **Evidence:** `src/app/api/purchase-orders/[id]/route.ts`
- **Problem:** A PO can be marked `RECEIVED` without recording received quantities or updating on-hand stock; partial receipts are not modeled.
- **Impact:** Inventory says parts arrived when they did not, or stock never increases.
- **Reproduce / verify:** Create a PO with 5 units and PATCH status to `RECEIVED`.
- **Recommended fix:** Add a receive action with per-line `receivedQty`, update inventory in a transaction, and allow partial status.
- **Effort:** M
- **Confidence:** Confirmed.

### [PART-005] Inventory adjustments can produce negative stock
- **Severity:** P2
- **Area:** Inventory integrity
- **Evidence:** `src/app/api/parts/[id]/route.ts` (quantity update), job-parts usage
- **Problem:** Quantity is a mutable integer; there is no movement ledger and no guard against using more than on hand.
- **Impact:** Negative inventory, wrong reorder points, inaccurate job cost.
- **Reproduce / verify:** Set quantity to 1, add 5 to a job.
- **Recommended fix:** Add `InventoryMovement` (receive/use/adjust/return), compute on-hand from movements or update with a conditional `quantity >= used`, and block negative stock with an override reason.
- **Effort:** M
- **Confidence:** Confirmed.

### [PART-006] Markup and price inputs are not bounded
- **Severity:** P2
- **Area:** Pricing
- **Evidence:** `src/app/api/parts/route.ts`, `src/app/api/job-parts/route.ts`
- **Problem:** Markup/price fields accept broad numbers; negative markup or extreme values can produce zero/negative sell prices.
- **Impact:** Accidental free parts or absurd invoices.
- **Reproduce / verify:** Create a part with `unitCost: 100`, `markup: -2`.
- **Recommended fix:** Validate `markup >= 0`, `unitPrice >= 0`, and warn/block sell price below cost unless an admin override is recorded.
- **Effort:** S
- **Confidence:** Confirmed.

### [PART-007] External parts availability failures are not actionable
- **Severity:** P2
- **Area:** Integration reliability
- **Evidence:** `src/app/api/parts/search/route.ts`, `src/lib/parts-provider.ts`
- **Problem:** When `PARTSTECH_*` is missing or the provider errors, the UI gets an empty result or a generic failure with no distinction between “no results” and “provider down.”
- **Impact:** Staff cannot tell whether a part is unavailable or the integration is broken.
- **Reproduce / verify:** Unset `PARTSTECH_*` and search.
- **Recommended fix:** Return a structured `{ configured: false, error }` state and show a clear banner; fall back to local catalog search.
- **Effort:** S
- **Confidence:** Confirmed (configuration unset in this environment).

### [PART-008] Parts-only jobs did not apply automatic markup
- **Severity:** P2
- **Area:** Billing correctness
- **Evidence:** parts-only job flow (pre-fix), `src/lib/pricing.ts`
- **Problem:** Jobs with parts but no labor skipped the markup calculation, so sell price equaled cost.
- **Impact:** Lost margin on parts-only work.
- **Reproduce / verify:** Create a parts-only job and compare sell price to cost.
- **Recommended fix:** Apply the shop’s parts markup whenever a part is added, regardless of labor presence; keep an explicit override.
- **Effort:** S
- **Confidence:** Confirmed — fixed in a prior pass.

### [PART-009] No vendor price history or preferred-vendor comparison
- **Severity:** P3
- **Area:** Purchasing
- **Evidence:** vendor/part models
- **Problem:** Vendor pricing is a single current value; there is no history or side-by-side comparison.
- **Impact:** Hard to verify price increases or choose the cheapest supplier.
- **Recommended fix:** Add `VendorPartPrice` history and show the last N prices per vendor.
- **Effort:** M
- **Confidence:** Confirmed.

### [PART-010] No reorder automation
- **Severity:** P3
- **Area:** Inventory workflow
- **Evidence:** `Part.reorderPoint`, notifications
- **Problem:** Low-stock notifications exist, but there is no one-click “create PO from low stock” or suggested order quantity.
- **Impact:** Manual purchasing work.
- **Recommended fix:** Add a low-stock view that groups by preferred vendor and pre-fills a PO.
- **Effort:** M
- **Confidence:** Confirmed.

### [PART-011] Technicians could still edit part cost, price, and markup
- **Severity:** P1
- **Area:** Financial authorization
- **Evidence:** `src/app/api/parts/route.ts` (GET, POST), `src/app/api/parts/[id]/route.ts` (PATCH, DELETE)
- **Problem:** The Zod whitelist removed arbitrary fields but did not restrict pricing fields by role on create, and the PATCH guard only blocked money fields while still allowing technicians to change quantity, vendor, inventory item, PO, and return fields. Technicians could also list every job part with vendor cost/margin, and delete any part. Technicians can reach `/api/parts` and `/parts`.
- **Impact:** Margin manipulation, free or mispriced parts, incorrect inventory movement, deletion of billed parts, and exposure of vendor cost/margin across other technicians' jobs.
- **Reproduce / verify:** As a technician, POST a job part with `{ "unitCost": 0, "unitPrice": 0 }`, PATCH a part's `quantity`, or GET `/api/parts?jobId=<another-tech-job>`.
- **Recommended fix:** Allow technicians to create a bare part request and update status/notes only; require parts/dispatch/office roles for vendor, inventory, pricing, quantity, and delete actions; scope the parts list to the technician's assigned jobs and strip vendor/margin fields from their responses.
- **Effort:** S
- **Confidence:** Confirmed - fixed in this pass with `src/lib/part-visibility.ts`, route-level checks, and `src/__tests__/part-visibility.test.ts`.

## What already works well
- Parts catalog supports local and external search, part numbers, cost, price, and markup.
- Job parts support status (`REQUESTED`, `ORDERED`, `RECEIVED`, `INSTALLED`) and vendor linkage.
- Purchase orders have vendor, lines, totals, and status.
- Parts-only auto markup works.
- Low-stock notifications are generated.

## Cross-section references
- Tenant isolation: `10-database-data-integrity.md` / DATA-001.
- Invoice line items: `04-billing-payments.md` / BILL-006.
- Parts availability runtime: `11-platform-infra.md` / PLAT-008.

## Verification commands / limitations
- `npm run type-check`, `npm run lint`, `npm test -- --run` — clean.
- `PARTSTECH_*` is unset, so live availability/ordering is `Unverified — needs runtime`.
- Inventory drift cannot be reproduced without a seeded multi-user scenario.
