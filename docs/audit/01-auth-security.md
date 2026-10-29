# 01 — Auth & Security Audit

## Verdict
**Ship with fixes.** The application-level auth boundary was the weakest part of the system: most API routes only checked “is logged in”, not “is this role allowed”, and registration auto-linked existing customer records by unverified email. Those are now fixed at the proxy, route, and record-ownership layers. Remaining risk is mostly multi-tenant isolation and distributed rate limiting, which are architectural rather than one-line bugs.

## Scorecard
| Dimension | Grade | Notes |
|---|---|---|
| Correctness | B | Role and ownership checks now cover the main staff/customer/tech boundaries. |
| Security & tenant isolation | C | No `shopId` on most models; every staff user can read all shops’ data. |
| Data integrity | B | Sensitive mutations are whitelisted; job/vehicle/customer relations validated. |
| Error handling | B | 401/403/409/429 are now used instead of silent success in sensitive paths. |
| UX & accessibility | B | Role redirects work; some 403s still surface as generic errors. |
| Performance | C | In-memory rate limiting is per serverless instance. |
| Maintainability | B | Central proxy allowlists are clear; many routes still use `requireAuth` only. |

## Coverage matrix
| Item | Type | Result | Notes |
|---|---|---|---|
| `src/proxy.ts` | middleware | PASS | Public/customer/tech allowlists and page confinement. |
| `src/lib/api-helpers.ts` | auth helper | PASS | `requireAuth` / `requireRole` are correct. |
| `src/lib/auth.ts` | NextAuth config | PASS | Credentials + TOTP flow; no open registration of ADMIN. |
| `POST /api/auth/register` | API | PASS | Staff invite code; existing customer email no longer auto-linked. |
| `POST /api/auth/reset-request` | API | PASS | Requires email provider and reports provider failure. |
| `/api/payroll`, `/api/reports` | API | PASS | ADMIN/ACCOUNTANT only. |
| `/api/shops` mutations | API | PASS | ADMIN only. |
| `/api/jobs/[id]` + subroutes | API | PASS | Technician ownership checks added. |
| `/api/sms/webhook` | API | PASS | Twilio signature required. |
| `/api/cron/*` | API | PASS | Secret required; no fake sends. |
| Tenant scoping | data layer | FAIL | See AUTH-010 / DATA-001. |
| Rate limiting | infra | PASS | DB-backed `RateLimit` table with in-memory fallback. |
| Session revocation | auth | FAIL | JWT remains valid until expiry. |

## Findings

### [AUTH-001] Customer accounts could call staff APIs and open staff pages
- **Severity:** P0
- **Area:** Authorization boundary
- **Evidence:** `src/lib/api-helpers.ts:6`, `src/proxy.ts:39`, `src/proxy.ts:163`
- **Problem:** `requireAuth()` only proves a session exists. Before this pass, most routes did not call `requireRole`, so a `CUSTOMER` token could call payroll, reports, invoices, users, shops, fleet, marketing, and `/tech` pages.
- **Impact:** Any customer could read staff data and mutate shop records.
- **Reproduce / verify:** Log in as a customer, call `GET /api/payroll` or `GET /api/customers` before the fix.
- **Recommended fix:** Add a default-deny proxy with explicit public and customer allowlists; add `requireRole` to every sensitive route.
- **Effort:** M
- **Confidence:** Confirmed — fixed in this pass.

### [AUTH-002] Registration auto-linked an existing customer by unverified email
- **Severity:** P0
- **Area:** Account takeover / privacy
- **Evidence:** `src/app/api/auth/register/route.ts:38`
- **Problem:** If a `Customer` row already existed for an email, registration attached the new `User` to that `customerId` without proving email ownership. An attacker could register with a victim’s email and read their jobs, invoices, vehicles, and messages.
- **Impact:** Full customer-account takeover for any known email.
- **Reproduce / verify:** Create a customer with `victim@example.com`, register a new account with that email, open `/customer`.
- **Recommended fix:** Never auto-link existing customer records during unverified registration. Return `409` and require staff activation or a future verified-email claim flow.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [AUTH-003] Public `GET /api/booking` exposed every service request
- **Severity:** P1
- **Area:** Public API
- **Evidence:** `src/app/api/booking/route.ts`, `src/proxy.ts:119`
- **Problem:** Booking POST must be public, but the GET list was also public and returned all booking requests, including customer names and contact details.
- **Impact:** Anyone could enumerate inbound leads and customer PII.
- **Reproduce / verify:** `curl https://<host>/api/booking` without a session.
- **Recommended fix:** Keep only `POST /api/booking` public; require `ADMIN`, `DISPATCHER`, or `SERVICE_ADVISOR` for GET.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [AUTH-004] Portal token creation was public
- **Severity:** P1
- **Area:** Public API
- **Evidence:** `src/app/api/portal/[token]/route.ts`
- **Problem:** The POST that creates/returns a customer portal token was reachable without a session. Anyone who knew a customer ID could mint a portal link.
- **Impact:** Customer portal data exposure.
- **Reproduce / verify:** POST `/api/portal/<customerId>` without cookies.
- **Recommended fix:** Require a staff role for token creation; keep only the tokenized GET and message POST public.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [AUTH-005] Technicians could reach financial and admin APIs
- **Severity:** P1
- **Area:** RBAC
- **Evidence:** `src/proxy.ts:57`, `src/proxy.ts:178`
- **Problem:** Technician sessions were treated like any staff session. Payroll, reports, invoices, quotes, users, fleet, inventory, and marketing APIs/pages were reachable by direct URL.
- **Impact:** Technicians could read pay rates, revenue, customer billing, and admin data.
- **Reproduce / verify:** Log in as `TECHNICIAN`, open `/payroll` or call `/api/reports`.
- **Recommended fix:** Block financial/admin prefixes for `TECHNICIAN`; keep `/tech`, jobs, diagnostics, photos, inspections, and labor settings.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [AUTH-006] Cron endpoints accepted requests when `CRON_SECRET` was unset
- **Severity:** P1
- **Area:** Scheduled jobs
- **Evidence:** `src/app/api/cron/reviews/route.ts`, `src/app/api/cron/maintenance/route.ts`
- **Problem:** Some cron routes compared the header to `process.env.CRON_SECRET` without rejecting the “unset” case, so a request with an empty/undefined value could run jobs. Others had inconsistent checks.
- **Impact:** Anyone could trigger review requests, maintenance reminders, sequence sends, and overdue emails.
- **Reproduce / verify:** Call a cron route without `Authorization` on an environment where `CRON_SECRET` is unset.
- **Recommended fix:** Require a configured secret in every cron route and compare in constant time; return `503` if unset.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [AUTH-007] Inbound SMS webhook accepted spoofed Twilio requests
- **Severity:** P1
- **Area:** Webhook integrity
- **Evidence:** `src/app/api/sms/webhook/route.ts:5`
- **Problem:** The Twilio form POST was trusted without validating `X-Twilio-Signature`. Anyone could inject inbound messages, forge STOP/opt-out replies, and pollute customer threads.
- **Impact:** Social-engineering and consent/opt-out corruption.
- **Reproduce / verify:** POST form fields `From`, `Body`, `MessageSid` to the webhook without a signature.
- **Recommended fix:** Validate the Twilio signature with `TWILIO_AUTH_TOKEN` and the exact public URL; reject with `403`; dedupe by `MessageSid`.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [AUTH-008] Technicians could read or mutate any job by ID
- **Severity:** P1
- **Area:** Object-level authorization
- **Evidence:** `src/app/api/jobs/[id]/route.ts:93`, `src/app/api/jobs/[id]/inspection/route.ts:70`, `src/app/api/jobs/[id]/timelog/route.ts:24`
- **Problem:** Job detail, inspection, notes, photos, timelog, health score, signature, and inspection-send routes only checked for a session. A technician could open another technician’s job, add notes/photos, clock time, and capture signatures. Clock-out also updated any `logId` without checking job or technician.
- **Impact:** Cross-technician data exposure and falsified labor/signatures.
- **Reproduce / verify:** As tech A, call `GET /api/jobs/<tech-B-job-id>` or clock out tech B’s `logId`.
- **Recommended fix:** For `TECHNICIAN`, require `job.technicianId === session.user.id`; scope clock-out by `jobId` and `technicianId`.
- **Effort:** M
- **Confidence:** Confirmed — fixed in this pass.

### [AUTH-009] Rate limiting is per serverless instance
- **Status:** Fixed on branch `devin/*-platform`: DB-backed `RateLimit` table.
- **Severity:** P2
- **Area:** Abuse resistance
- **Evidence:** `src/lib/rate-limit.ts:1`
- **Problem:** The sliding window lives in a process-local `Map`. Vercel scales horizontally, so an attacker gets a fresh budget per instance and cold start.
- **Impact:** Login, AI, registration, and public endpoint abuse limits are weaker than they appear.
- **Reproduce / verify:** Send requests across multiple concurrent lambda instances and observe limits reset.
- **Recommended fix:** Move to Upstash Redis / Vercel KV or a database-backed limiter for auth, AI, booking, tracking, and webhooks.
- **Effort:** M
- **Confidence:** Confirmed.

### [AUTH-010] No tenant/shop scoping on most reads
- **Severity:** P2
- **Area:** Multi-tenant isolation
- **Evidence:** `prisma/schema.prisma` (only `User.shopId`/`Job.shopId` on selected models); `src/app/api/customers/route.ts:27`
- **Problem:** Customer, vehicle, invoice, quote, part, vendor, and report queries are global. Any staff user in any shop can read all records.
- **Impact:** If a second shop or sub-tenant is added, data leaks immediately.
- **Reproduce / verify:** Create two shops and two staff users; list customers as shop B.
- **Recommended fix:** Add `shopId` to tenant-owned models, derive it from the session, and enforce it in every query/mutation; add composite indexes.
- **Effort:** L
- **Confidence:** Confirmed.

### [AUTH-011] Role changes do not revoke existing sessions
- **Severity:** P2
- **Area:** Session lifecycle
- **Evidence:** `src/lib/auth.ts` (JWT strategy)
- **Problem:** A user demoted from ADMIN to TECHNICIAN keeps the old role in their JWT until expiry. Disabling a user does not invalidate the token either.
- **Impact:** Former staff retain access for the token lifetime.
- **Reproduce / verify:** Change a user’s role in the DB, keep the existing cookie, call an admin API.
- **Recommended fix:** Add a `sessionVersion`/`tokenInvalidAfter` claim checked in `jwt`/`session` callbacks; bump on role change, password reset, and deactivation.
- **Effort:** M
- **Confidence:** Confirmed.

### [AUTH-012] `totp-check` enables account/2FA enumeration
- **Severity:** P3
- **Area:** Auth information disclosure
- **Evidence:** `src/app/api/auth/totp-check/route.ts`
- **Problem:** A public endpoint reports whether an email has TOTP enabled.
- **Impact:** Helps targeted phishing and account enumeration.
- **Reproduce / verify:** POST known and unknown emails and compare responses/timing.
- **Recommended fix:** Require the password (or a short-lived login challenge token) before revealing TOTP state; rate-limit by IP and email.
- **Effort:** S
- **Confidence:** Confirmed.

### [AUTH-013] Password-reset tokens are stored without hashing
- **Severity:** P2
- **Area:** Credential recovery
- **Evidence:** `prisma/schema.prisma` (`PasswordResetToken.token`), `src/app/api/auth/reset-request/route.ts`
- **Problem:** Reset tokens are persisted in plaintext and are valid for a fixed window; a DB read or backup leak allows immediate account takeover.
- **Impact:** Reset-token theft from backups/logs.
- **Reproduce / verify:** Inspect the token row after requesting a reset.
- **Recommended fix:** Store a SHA-256 hash of the token, compare hashes, and invalidate all outstanding tokens after use.
- **Effort:** S
- **Confidence:** Confirmed.

### [AUTH-014] Password policy is length-only
- **Severity:** P3
- **Area:** Account security
- **Evidence:** `src/app/api/auth/register/route.ts:12`
- **Problem:** Minimum 8 characters, no breached-password check, no maximum attempt lockout beyond the in-memory limiter.
- **Impact:** Weak staff passwords are plausible on shared shop devices.
- **Recommended fix:** Add a breached-password check (k-anonymity API or local list), a 12-character minimum for staff, and durable login lockout.
- **Effort:** S
- **Confidence:** Confirmed.

### [AUTH-015] Technicians could read customer financials and warranty records
- **Severity:** P1
- **Area:** Role boundary / customer privacy
- **Evidence:** `src/proxy.ts` (`TECH_BLOCKED_API_PREFIXES`), `src/app/api/customers/route.ts`, `src/app/api/customers/[id]/route.ts`, `src/app/api/vehicles/[id]/route.ts`, `src/app/api/warranties/route.ts`, `src/app/api/warranties/[id]/route.ts`
- **Problem:** The technician blocklist named `/api/warranty` (singular), but the real API is `/api/warranties`, so technicians could list, create, claim, void, and read warranties. The customer list/detail APIs also returned invoice history, `_count.invoices`, lifetime revenue, average ticket, and CLV to technicians, and vehicle detail returned each job's quote and invoice totals.
- **Impact:** A shop-floor account could read customer money data and alter warranty claims, bypassing the navigation and page-level restrictions that hide Warranty, Invoices, and Reports.
- **Reproduce / verify:** Sign in as `TECHNICIAN`; call `GET /api/warranties`, `GET /api/customers`, and `GET /api/customers/<id>`. Before the fix the first returned records and the customer responses included `invoices`/`clv`.
- **Recommended fix:** Add both warranty route spellings to the technician API boundary; require `ADMIN`/`DISPATCHER` in the warranty routes themselves; and redact invoice history, invoice counts, revenue, average ticket, CLV, and per-job quote/invoice totals from customer and vehicle responses for roles outside `ADMIN`, `DISPATCHER`, `ACCOUNTANT`, and `SERVICE_ADVISOR`.
- **Effort:** S
- **Confidence:** Confirmed - fixed in this pass with `src/lib/role-access.ts`, route-level role checks, and `src/__tests__/role-access.test.ts`.

## What already works well
- NextAuth credentials + TOTP, bcrypt hashing, and invite-code-gated staff registration.
- `requireRole` is simple and readable; the new proxy allowlists are default-deny.
- Audit logging exists for many sensitive mutations.
- Cron routes now fail closed when configuration is missing.
- Stripe and Twilio webhooks now reject unsigned/replayed requests.

## Cross-section references
- Tenant scoping: `10-database-data-integrity.md` / DATA-001.
- Service-worker cache privacy: `11-platform-infra.md` / PLAT-001.
- Job ownership: `03-jobs-dispatch-tech.md` / JOBS-001.

## Verification commands / limitations
- `npm run type-check`, `npm run lint`, `npm test -- --run` — clean after fixes.
- Runtime role-matrix verification needs seeded users for each role and a running server.
- Twilio signature verification cannot be exercised without real `TWILIO_AUTH_TOKEN` and the exact public webhook URL.
