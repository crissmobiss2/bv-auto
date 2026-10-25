# 10 — Database & Data Integrity Audit

## Verdict
**Do not scale multi-tenant yet.** The schema is broad (48 models) and the single-shop workflow works, but tenant ownership is inconsistent, there is no migration history, money is frequently converted to `Number`, and several destructive paths have no soft delete or audit. These are structural issues, not UI polish.

## Scorecard
| Dimension | Grade | Notes |
|---|---|---|
| Correctness | B- | Relations mostly sound; some status/quantity invariants unenforced. |
| Security & tenant isolation | D | Most models have no `shopId`; queries are global. |
| Data integrity | C+ | No migrations, no ledger for inventory, no refunds. |
| Error handling | B- | Prisma errors sometimes surface as 500s. |
| Performance | B- | Basic indexes exist; hot report/query paths need review. |
| Maintainability | C+ | Schema is large; migration and seed discipline missing. |

## Coverage matrix
| Item | Type | Result | Notes |
|---|---|---|---|
| `prisma/schema.prisma` | schema | PARTIAL | 48 models; tenant fields inconsistent. |
| `prisma/migrations/` | migrations | FAIL | No migration history; `db push` workflow. |
| Seed script | data | PASS | Local demo seed exists. |
| Money fields | schema | PARTIAL | `Decimal` in DB, `Number` in app. |
| Inventory movements | schema | FAIL | Quantity is mutable; no ledger. |
| Payment idempotency | schema | FAIL | No unique external ID. |
| Soft delete | schema | PARTIAL | `isActive` on some models; hard deletes elsewhere. |
| Audit log | schema | PARTIAL | Exists, but not used on all mutations. |
| Customer merge | schema | FAIL | No merge/redirect model. |
| Backups/retention | ops | FAIL | Not defined in repo. |

## Findings

### [DATA-001] Most tenant-owned models have no `shopId`
- **Severity:** P0 (for multi-shop), P2 for single-shop
- **Area:** Tenant isolation
- **Evidence:** `prisma/schema.prisma` (`Customer`, `Vehicle`, `Invoice`, `Quote`, `Part`, `Vendor`, `PurchaseOrder`, `Payment`, `SmsMessage`)
- **Problem:** Only selected models carry `shopId`. All customer/vehicle/billing/parts queries are global.
- **Impact:** A second shop immediately sees the first shop’s customers, prices, payroll, and revenue. For the current single shop it is a latent architectural risk.
- **Reproduce / verify:** Create two shops and query customers as shop B.
- **Recommended fix:** Add `shopId` to every tenant-owned model, backfill from the current shop, enforce it in a repository/query helper, and add composite indexes. Do this before onboarding a second shop.
- **Effort:** L
- **Confidence:** Confirmed.

### [DATA-002] Destructive routes hard-delete without a recovery path
- **Severity:** P1
- **Area:** Data loss
- **Evidence:** parts/vendors/campaigns DELETE routes
- **Problem:** Several records are permanently deleted. Related rows may cascade or block; there is no archive/restore.
- **Impact:** Accidental deletion is unrecoverable without a database backup.
- **Reproduce / verify:** Delete a part used on a job and inspect related records.
- **Recommended fix:** Prefer `isActive`/`archivedAt`; for true deletes, require admin confirmation, log before-state, and provide a restore window.
- **Effort:** M
- **Confidence:** Confirmed.

### [DATA-003] No Prisma migration history
- **Severity:** P2
- **Area:** Deploy safety
- **Evidence:** repository has `prisma/schema.prisma` but no `prisma/migrations/`
- **Problem:** Production uses `prisma db push`, which can apply destructive changes without a reviewable SQL history.
- **Impact:** Schema drift and risky production changes.
- **Reproduce / verify:** `npx prisma migrate status` (no migrations).
- **Recommended fix:** Baseline a migration, switch deploys to `prisma migrate deploy`, and require review for schema changes.
- **Effort:** M
- **Confidence:** Confirmed.

### [DATA-004] Money is converted from `Decimal` to `Number` throughout
- **Severity:** P2
- **Area:** Financial precision
- **Evidence:** API routes (`Number(invoice.amountDue)`, totals), `src/lib/utils.ts`
- **Problem:** `Prisma.Decimal` is converted to JS floats for arithmetic and serialization.
- **Impact:** Rounding drift and equality/comparison bugs.
- **Recommended fix:** Keep `Decimal` end-to-end or convert to integer cents at the boundary; centralize money helpers and tests.
- **Effort:** M
- **Confidence:** Confirmed.

### [DATA-005] Document number generation can collide
- **Severity:** P2
- **Area:** Data integrity
- **Evidence:** `src/lib/utils.ts` (`generateJobNumber`, `generateInvoiceNumber`, `generateQuoteNumber`)
- **Problem:** Numbers are generated in application code before insert; concurrent requests can collide and produce a unique-constraint 500.
- **Impact:** Failed creates during busy periods.
- **Recommended fix:** Use a DB sequence/table counter or retry on `P2002`.
- **Effort:** S
- **Confidence:** Likely.

### [DATA-006] Payments have no unique external ID
- **Severity:** P2
- **Area:** Duplicate prevention
- **Evidence:** `prisma/schema.prisma` (`Payment`), Stripe webhook
- **Problem:** Stripe dedupe uses `reference`/session lookups, but there is no unique constraint on an external payment ID. Manual payments also have no idempotency key.
- **Impact:** Duplicate payments under retries/races.
- **Recommended fix:** Add `externalId` (unique per provider) and a client idempotency key; keep `reference` for checks/notes.
- **Effort:** S
- **Confidence:** Confirmed.

### [DATA-007] No customer/vehicle merge model
- **Severity:** P2
- **Area:** Data quality
- **Evidence:** schema
- **Problem:** Duplicate customers/vehicles cannot be merged; history is split.
- **Impact:** Wrong service history and marketing duplication.
- **Recommended fix:** Add `mergedIntoId` and a transactional merge that re-points vehicles/jobs/invoices/messages.
- **Effort:** M
- **Confidence:** Confirmed.

### [DATA-008] Offline queue can replay another user’s mutations
- **Severity:** P2
- **Area:** Shared-device privacy
- **Evidence:** `src/lib/offline-queue.ts`
- **Problem:** The queue persists mutations in browser storage and flushes on reconnect. If a technician signs out with pending items, the next user on the device may replay them under their session.
- **Impact:** Cross-user data writes and confusing audit trails.
- **Reproduce / verify:** Queue a status update, sign out, sign in as another tech, reconnect.
- **Recommended fix:** Namespace the queue by user ID, clear it on sign-out, and reject replays whose session user differs.
- **Effort:** S
- **Confidence:** Confirmed.

### [DATA-009] No backup/restore/retention policy in the repo
- **Severity:** P2
- **Area:** Operations
- **Evidence:** no documented backup config
- **Problem:** Recovery depends entirely on the database provider’s defaults; there is no tested restore.
- **Impact:** Data loss after an accidental delete or bad migration.
- **Recommended fix:** Enable PITR/backups, document RPO/RTO, and run a restore drill.
- **Effort:** S
- **Confidence:** Confirmed.

### [DATA-010] Audit log stores PII with no retention policy
- **Severity:** P3
- **Area:** Privacy
- **Evidence:** `prisma/schema.prisma` (`AuditLog.before/after`), `src/lib/api-helpers.ts:26`
- **Problem:** Before/after JSON can contain customer names, phones, emails, and payment data; it is retained indefinitely.
- **Impact:** Privacy/compliance exposure.
- **Recommended fix:** Redact sensitive fields, define retention, and restrict audit access to admins.
- **Effort:** S
- **Confidence:** Confirmed.

### [DATA-011] Missing/insufficient indexes on hot paths
- **Severity:** P2
- **Area:** Performance
- **Evidence:** schema indexes
- **Problem:** Hot queries filter by `scheduledAt`, `status`, `customerId`, `phone`, and `shopId`; not all combinations are indexed.
- **Impact:** Slower lists/reports as data grows.
- **Recommended fix:** Add `@@index([shopId, scheduledAt])`, `@@index([shopId, status])`, `@@index([customerId, createdAt])`, and a normalized phone index.
- **Effort:** S
- **Confidence:** Likely.

## What already works well
- 48 models cover the domain comprehensively.
- Foreign keys and unique constraints exist for numbers/tokens.
- `AuditLog` exists and is used on key status/payment changes.
- Seed and cleanup scripts support local development.
- Prisma client is generated and type-checks cleanly.

## Cross-section references
- Tenant auth: `01-auth-security.md` / AUTH-010.
- Payment idempotency: `04-billing-payments.md` / BILL-001, BILL-010.
- Inventory ledger: `06-parts-inventory.md` / PART-005.
- Offline queue: `03-jobs-dispatch-tech.md` / JOBS-012.

## Verification commands / limitations
- `npx prisma validate` — passes.
- Local PostgreSQL is on Docker (`bvauto-pg`, port 5433); production `db:push` is blocked pending a Neon `DATABASE_URL`.
- No production data was touched during this audit.
