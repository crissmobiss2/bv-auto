# 03 — Jobs, Dispatch & Technician Portal Audit

## Verdict
**Ship with fixes.** The core job lifecycle, dispatch drag-and-drop, technician job list, inspections, photos, time clock, and signatures are present and usable. Object-level authorization for technicians and the vehicle/customer relation were the serious gaps; both are now closed. Status transitions and timezone behavior still need hardening.

## Scorecard
| Dimension | Grade | Notes |
|---|---|---|
| Correctness | B | Job CRUD works; ownership and relation checks added. |
| Security & tenant isolation | B- | Tech object-level checks added; no shop scoping. |
| Data integrity | B | No formal state machine; some transitions can go backwards. |
| Error handling | B | Validation is good; some FK/date errors still 500. |
| UX & accessibility | B | Mobile tech flow works; New Job customer picker is weak. |
| Performance | B- | Job detail loads many relations in one query; lists clamped. |
| Maintainability | B | Routes are readable but job sub-routes duplicate ownership logic. |

## Coverage matrix
| Item | Type | Result | Notes |
|---|---|---|---|
| `/jobs` list/create | Page/API | PASS | Pagination clamped; relation checks added. |
| `/jobs/[id]` detail/update | Page/API | PASS | Tech ownership + reassignment block added. |
| `/jobs/new` | Page | PASS | Real customer/vehicle/technician; local time converted to ISO. |
| `/dispatch` | Page/API | PASS | Drag/drop reschedule works; uses ISO. |
| `/pipeline` | Page/API | PASS | Status board; no transition rules. |
| `/tech` job list | Page | PASS | API now filters to the session technician’s jobs. |
| `/tech/jobs/[id]` | Page | PASS | Detail, notes, photos, clock, signature. |
| Inspection GET/POST/send | API | PASS | Real email send; ownership checks. |
| Insurance/sublet routes | API | PASS | Staff-only; sublet must belong to the job. |
| Job photos upload/view | API | PASS | MIME allowlist + ownership; no SVG/HTML. |
| Time log clock-in/out | API | PASS | Clock-out scoped to job and technician. |
| Health score | API | PASS | Ownership check added. |
| Status transitions | Workflow | FAIL | No allowed-transition matrix. |
| Shop scoping | Data | FAIL | See DATA-001. |

## Findings

### [JOBS-001] Technician could read/mutate any job by ID
- **Severity:** P1
- **Area:** Object-level authorization
- **Evidence:** `src/app/api/jobs/[id]/route.ts:93`, `src/app/api/jobs/[id]/inspection/route.ts:70`, `src/app/api/jobs/[id]/notes/route.ts:11`
- **Problem:** Job detail, inspection, notes, photos, timelog, health score, signature, and inspection-send only required a session. Any technician could use a known job ID to view another tech’s customer/vehicle, add notes/photos, clock time, or capture a signature. Clock-out also accepted any `logId`.
- **Impact:** Cross-technician privacy breach and falsified labor/signatures.
- **Reproduce / verify:** As tech A, call `GET /api/jobs/<tech-B-job>` and `POST /api/jobs/<tech-B-job>/notes`.
- **Recommended fix:** Require `job.technicianId === session.user.id` for technicians; scope clock-out by `jobId` and `technicianId`; block technician reassignment.
- **Effort:** M
- **Confidence:** Confirmed — fixed in this pass.

### [JOBS-002] Job PATCH accepted arbitrary fields
- **Severity:** P1
- **Area:** Mass assignment
- **Evidence:** `src/app/api/jobs/[id]/route.ts:125`
- **Problem:** The update handler spread the parsed body, and the schema included many fields; without a strict whitelist a caller could alter internal fields such as `vehicleHealthScore`, `fleetAccountId`, or `requiresReturn` from a technician session.
- **Impact:** Unauthorized changes to job state and billing metadata.
- **Reproduce / verify:** PATCH a job with `{ "vehicleHealthScore": 100, "fleetAccountId": "..." }`.
- **Recommended fix:** Role-aware whitelists: technicians may change status, notes, checklist, and time; dispatch/admin may reassign and edit billing-related fields.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass (technician reassignment blocked; schema already whitelisted fields).

### [JOBS-003] Job could be created with a mismatched vehicle/customer
- **Severity:** P1
- **Area:** Data integrity
- **Evidence:** `src/app/api/jobs/route.ts` (POST)
- **Problem:** `customerId` and `vehicleId` were accepted independently.
- **Impact:** Estimates, invoices, inspections, and history attached to the wrong car.
- **Reproduce / verify:** POST a job with customer A and vehicle B.
- **Recommended fix:** Validate `vehicle.customerId === customer.id` and technician role/active state.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [JOBS-004] Inspection “send” was an HTML preview, not a delivery
- **Severity:** P1
- **Area:** Customer communication / XSS
- **Evidence:** `src/app/api/jobs/[id]/inspection/send/route.ts`, `src/lib/email.ts`
- **Problem:** The route returned an HTML preview instead of emailing the report, and interpolated customer/vehicle/checklist fields without escaping.
- **Impact:** Technicians believed the report was sent; malicious customer data could execute in the preview.
- **Reproduce / verify:** Send an inspection with a customer name containing `<script>`.
- **Recommended fix:** Require `RESEND_API_KEY` and a customer email, send via Resend, escape all fields, and return JSON with a real error on failure.
- **Effort:** M
- **Confidence:** Confirmed — fixed in this pass.

### [JOBS-005] No allowed status-transition matrix
- **Severity:** P2
- **Area:** Workflow correctness
- **Evidence:** `src/app/api/jobs/[id]/route.ts:142`
- **Problem:** Any `JobStatus` can be set from any other status. A paid/closed job can be moved back to `ESTIMATE`; a job can be `COMPLETED` before `IN_PROGRESS`; cancellation has no side effects.
- **Impact:** Broken pipeline counts, duplicate notifications, invalid labor/invoice state.
- **Reproduce / verify:** PATCH a `COMPLETED` job to `ESTIMATE`.
- **Recommended fix:** Central `canTransition(from, to, role)` map; return `409` for invalid transitions; define cancellation and reopen behavior.
- **Effort:** M
- **Confidence:** Confirmed.

### [JOBS-006] “Today” and scheduled times used server/UTC boundaries
- **Severity:** P2
- **Area:** Timezone
- **Evidence:** `src/app/api/dashboard/route.ts:9`, `src/app/api/notifications/route.ts:8`, `src/app/(dashboard)/jobs/new/page.tsx:63`
- **Problem:** Dashboard “today”/week/month used the server’s local date (UTC on Vercel), and New Job sent a `datetime-local` wall-clock string without converting it. A 10:00 AM appointment could be stored as 10:00 UTC and display as 3:00 AM in California; evening jobs could vanish from “today”.
- **Impact:** Wrong daily schedule, missed jobs, wrong revenue windows.
- **Reproduce / verify:** Set `TZ=UTC`, create a 6:00 PM Pacific job, open the dashboard after 5:00 PM Pacific.
- **Recommended fix:** Convert browser wall time to ISO before POST; use a shop-timezone helper (`date-fns-tz`) for day/week/month boundaries.
- **Effort:** M
- **Confidence:** Confirmed — fixed in this pass.

### [JOBS-007] Job list limit was unbounded
- **Severity:** P2
- **Area:** Performance / DoS
- **Evidence:** `src/app/api/jobs/route.ts:30`
- **Problem:** `limit` was parsed directly and used in `take`.
- **Impact:** Large payloads and memory spikes.
- **Reproduce / verify:** `GET /api/jobs?limit=1000000`.
- **Recommended fix:** Clamp page/limit (max 100).
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [JOBS-008] Notes/photos/timelog had no job ownership check
- **Severity:** P1
- **Area:** Object-level authorization
- **Evidence:** `src/app/api/jobs/[id]/notes/route.ts`, `src/app/api/jobs/[id]/photos/route.ts`, `src/app/api/jobs/[id]/timelog/route.ts`
- **Problem:** These routes accepted any job ID for any authenticated user; notes did not even verify the job existed, so an invalid ID produced a foreign-key 500.
- **Impact:** Cross-job data injection and noisy 500s.
- **Reproduce / verify:** POST a note to a non-existent job or another tech’s job.
- **Recommended fix:** Fetch the job, return 404 if missing, enforce technician ownership, and cap note length.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [JOBS-009] Signature upload had no size cap and no ownership check
- **Severity:** P2
- **Area:** Storage abuse / integrity
- **Evidence:** `src/app/api/jobs/[id]/signature/route.ts:6`
- **Problem:** `imageData` accepted an unlimited base64 string; any authenticated user could attach a signature to any job.
- **Impact:** Storage exhaustion and forged signatures.
- **Reproduce / verify:** POST a 50 MB base64 blob to another tech’s job.
- **Recommended fix:** Cap `imageData` (~2 MB), cap signer fields, enforce technician ownership, and validate the data URL/MIME.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [JOBS-010] Job number generation is not concurrency-safe
- **Severity:** P2
- **Area:** Data integrity
- **Evidence:** `src/lib/utils.ts` (`generateJobNumber`)
- **Problem:** Numbers are generated from date + random/suffix before insert. Under concurrent creates a collision surfaces as a unique-constraint 500 rather than a retry.
- **Impact:** Failed job creation during busy intake.
- **Reproduce / verify:** Fire many concurrent `POST /api/jobs`.
- **Recommended fix:** Use a database sequence or retry on `P2002` with a new suffix; do the same for invoices/quotes.
- **Effort:** S
- **Confidence:** Likely.

### [JOBS-011] No shop scoping on jobs/dispatch
- **Severity:** P2
- **Area:** Tenant isolation
- **Evidence:** `src/app/api/jobs/route.ts`, `src/app/api/dispatch/route.ts`
- **Problem:** Jobs are global. `Job.shopId` exists but is not enforced.
- **Impact:** Cross-shop schedule and customer exposure.
- **Recommended fix:** Derive `shopId` from the session and filter every job query; add `@@index([shopId, scheduledAt])`.
- **Effort:** L
- **Confidence:** Confirmed.

### [JOBS-012] Notes and time logs are not audit-logged
- **Severity:** P3
- **Area:** Auditability
- **Evidence:** `src/app/api/jobs/[id]/notes/route.ts`, `src/app/api/jobs/[id]/timelog/route.ts`
- **Problem:** Job status changes are audited, but notes, photo uploads, and time edits are not.
- **Impact:** Hard to investigate disputes or falsified labor.
- **Recommended fix:** Log create/update/delete for notes, photos, timelog, and signatures with actor and job ID.
- **Effort:** S
- **Confidence:** Confirmed.

### [JOBS-013] Technician job list and insurance/sublet routes exposed all jobs
- **Severity:** P1
- **Area:** Object-level authorization / data minimization
- **Evidence:** `src/app/api/jobs/route.ts:22` (GET), `src/app/api/jobs/[id]/insurance/route.ts`
- **Problem:** The tech dashboard fetched `/api/jobs` without a technician filter, so the API returned every job’s customer/vehicle summary; the UI filtered client-side. Insurance/sublet GET/POST/PATCH were open to technicians and PATCH accepted a `subletId` from another job.
- **Impact:** Cross-technician customer/vehicle exposure and insurance/sublet data tampering.
- **Reproduce / verify:** As tech A, call `GET /api/jobs` and inspect other technicians’ jobs; PATCH a sublet from job B via job A’s URL.
- **Recommended fix:** Force `technicianId = session.user.id` for technician job lists; restrict insurance/sublet routes to admin/dispatch/service-advisor/accountant; verify `subletId` belongs to the job.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [JOBS-014] Job reassignment accepted inactive or non-technician users
- **Severity:** P2
- **Area:** Assignment integrity
- **Evidence:** `src/app/api/jobs/[id]/route.ts` (PATCH `technicianId`)
- **Problem:** Job creation validated the selected technician, but the update/reassign path did not. A dispatcher could assign a job to a customer, an inactive technician, or another staff role by crafting a PATCH.
- **Impact:** Jobs disappear from the technician board, pushes go to the wrong account, and assignment data becomes inconsistent.
- **Reproduce / verify:** PATCH a job with `technicianId` set to a customer or deactivated user ID.
- **Recommended fix:** Require an active `TECHNICIAN` (or `ADMIN`) when `technicianId` is set; keep `null` for unassign.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [JOBS-015] Photo DELETE had no job-ownership check
- **Severity:** P1
- **Area:** Object-level authorization / data loss
- **Evidence:** `src/app/api/jobs/[id]/photos/route.ts` (DELETE)
- **Problem:** Any authenticated technician could delete any job photo by supplying a known job ID and photo ID. The upload path enforced ownership, but DELETE did not.
- **Impact:** A technician could destroy another technician's inspection/repair evidence.
- **Reproduce / verify:** As tech A, call `DELETE /api/jobs/<tech-B-job>/photos` with a photo ID from that job.
- **Recommended fix:** Fetch the job, enforce technician ownership, and scope the photo lookup to the job before deleting.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

## What already works well
- Dispatch drag-and-drop reschedules with an ISO timestamp.
- Technician job cards show customer, vehicle, status, and quick actions.
- Offline queue exists for technician status/notes; 4xx failures are dropped instead of replayed forever.
- Inspection checklist, photo capture, health score, and signature capture are integrated into the tech job page.
- Status changes trigger customer SMS/push where configured (and now fail silently only when unconfigured).

## Cross-section references
- Auth boundary: `01-auth-security.md` / AUTH-008.
- Timezone helper: `11-platform-infra.md` / PLAT-010.
- Status workflow: `14-workflow-e2e.md` / FLOW-004.
- Offline queue: `10-database-data-integrity.md` / DATA-008.

## Verification commands / limitations
- `npm run type-check`, `npm run lint`, `npm test -- --run` — clean.
- Mobile tech workflow was exercised at a phone viewport; a real device/offline test is still needed.
- Status-transition behavior is code-inspected; no automated state-machine test exists.
