# 09 — AI, Diagnostics & Repair Data Audit

## Verdict
**Ship with fixes.** The AI endpoints are wired to Anthropic with rate limits and configuration checks, and AI estimate totals are now coerced and recomputed so numeric strings cannot produce nonsense. AI output is still trusted too much, model names are unverified, and there is no PII redaction or cost quota. Diagnostics/repair-data integrations are present but runtime-unverified.

## Scorecard
| Dimension | Grade | Notes |
|---|---|---|
| Correctness | B | Estimate math fixed; malformed model JSON still unhandled. |
| Security & tenant isolation | B- | Job-note ownership added; no shop scoping. |
| Data integrity | C+ | AI output is not schema-validated before use. |
| Error handling | B- | Missing key returns 503; raw provider errors leak. |
| UX & accessibility | B | Streaming diagnosis works; errors are terse. |
| Performance | B- | 10/min per IP; no token/cost budget. |
| Maintainability | C+ | Three AI routes duplicate provider/parse logic. |

## Coverage matrix
| Item | Type | Result | Notes |
|---|---|---|---|
| `POST /api/ai/diagnose` | API | PASS | Streaming + job note; ownership check. |
| `POST /api/ai/estimate` | API | PASS | Numeric coercion/recompute added. |
| `POST /api/ai/message` | API | PASS | Drafts customer message. |
| `/diagnostics` | Page | PASS | Tabs for scanner, AI, codes. |
| NHTSA recalls | API/lib | PARTIAL | Public API; rate limits/error UX. |
| TSB/repair data | API/lib | PARTIAL | Provider-dependent. |
| AI output schema | Validation | FAIL | No Zod schema for model response. |
| PII redaction | Privacy | FAIL | Full customer/vehicle context sent. |
| Cost quota | Billing | FAIL | No per-user/shop budget. |

## Findings

### [AI-001] AI estimate could concatenate numeric strings
- **Severity:** P1
- **Area:** Financial output
- **Evidence:** `src/app/api/ai/estimate/route.ts` (pre-fix)
- **Problem:** The model sometimes returns `"45.00"` strings. `reduce((s, i) => s + i.total, 0)` concatenated them (`"180.0045.00"`), and `shopSupplies` was added as a string.
- **Impact:** Absurd estimates presented to customers; wrong quote/invoice amounts.
- **Reproduce / verify:** Mock the model response with string totals and call the endpoint.
- **Recommended fix:** Coerce every numeric field with `Number`, recompute each line as `hours × rate` / `qty × price`, round to cents, and recompute the subtotal.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [AI-002] AI diagnosis could write notes to any job
- **Severity:** P1
- **Area:** Object-level authorization
- **Evidence:** `src/app/api/ai/diagnose/route.ts:20`
- **Problem:** `jobId` from the request body was used to append an AI note without verifying the job exists or that the technician is assigned.
- **Impact:** Cross-job data injection and misleading service notes.
- **Reproduce / verify:** As tech A, POST a diagnosis with tech B’s `jobId`.
- **Recommended fix:** Verify the job exists; for technicians require `job.technicianId === session.user.id`.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [AI-003] Model names are unverified
- **Severity:** P2
- **Area:** Provider compatibility
- **Evidence:** `src/app/api/ai/diagnose/route.ts` (`claude-sonnet-4-6`), `src/app/api/ai/message/route.ts` (`claude-haiku-4-5-20251001`)
- **Problem:** The model IDs are hard-coded. If either ID is not available to the account, every AI call fails.
- **Impact:** Diagnostics and message drafting can be completely down after a provider change.
- **Reproduce / verify:** Call each endpoint with a valid `ANTHROPIC_API_KEY`.
- **Recommended fix:** Move model IDs to env (`ANTHROPIC_MODEL_DIAGNOSE`, `ANTHROPIC_MODEL_MESSAGE`) with a known-good default; add a startup/health check.
- **Effort:** S
- **Confidence:** Unverified — needs runtime.

### [AI-004] Malformed model JSON produces a 500
- **Severity:** P2
- **Area:** Error handling
- **Evidence:** `src/app/api/ai/estimate/route.ts` (`JSON.parse`)
- **Problem:** The estimate route extracts the first JSON block and parses it; if the model returns prose or malformed JSON, the handler throws.
- **Impact:** Users see a generic failure instead of a retry/fallback.
- **Recommended fix:** Validate with a Zod schema, retry once with a “JSON only” instruction, and return `502` with a safe message.
- **Effort:** S
- **Confidence:** Confirmed.

### [AI-005] Prompt injection from customer/job text
- **Severity:** P2
- **Area:** AI safety
- **Evidence:** `src/app/api/ai/message/route.ts`, `src/app/api/ai/diagnose/route.ts`
- **Problem:** Customer names, vehicle info, symptoms, and job notes are interpolated directly into the prompt. A malicious value can instruct the model to ignore the system prompt or output unsafe content.
- **Impact:** Wrong diagnosis, offensive customer messages, or data exfiltration within the prompt.
- **Recommended fix:** Delimit untrusted fields, instruct the model to treat them as data, and validate output before display/send.
- **Effort:** M
- **Confidence:** Confirmed.

### [AI-006] PII is sent to Anthropic without redaction
- **Severity:** P2
- **Area:** Privacy
- **Evidence:** AI routes
- **Problem:** Customer names, phone, email, address, and full job history may be included in prompts; there is no minimization or retention note.
- **Impact:** Third-party PII processing without a clear policy.
- **Recommended fix:** Send only vehicle/symptom data needed; redact names/phone/email; document retention in the privacy policy.
- **Effort:** M
- **Confidence:** Confirmed.

### [AI-007] No cost quota or per-shop budget
- **Severity:** P2
- **Area:** Cost control
- **Evidence:** `src/lib/rate-limit.ts`, AI routes
- **Problem:** Limits are per IP per minute; a single authenticated user can generate many calls across instances. There is no monthly token/cost cap.
- **Impact:** Unexpected Anthropic bills.
- **Recommended fix:** Track token usage per user/shop, enforce daily/monthly budgets, and alert at thresholds.
- **Effort:** M
- **Confidence:** Confirmed.

### [AI-008] Raw provider errors are returned to the client
- **Severity:** P2
- **Area:** Information disclosure
- **Evidence:** AI routes (`error.message` in responses/streams)
- **Problem:** Provider error text may include model names, request IDs, or account details.
- **Impact:** Information leakage and confusing UX.
- **Recommended fix:** Log the raw error server-side; return a stable message plus a correlation ID.
- **Effort:** S
- **Confidence:** Confirmed.

### [AI-009] AI diagnosis is stored only as free-text notes
- **Severity:** P3
- **Area:** Data model
- **Evidence:** AI diagnose save-to-notes
- **Problem:** There is no structured `Diagnosis` record with symptoms, DTCs, confidence, and recommended tests.
- **Impact:** Hard to search, compare, or audit AI recommendations.
- **Recommended fix:** Add a `Diagnosis` model linked to job/vehicle/technician and store the structured output.
- **Effort:** M
- **Confidence:** Confirmed.

### [AI-010] Diagnostics/repair-data integrations are runtime-unverified
- **Severity:** P2
- **Area:** Integration
- **Evidence:** `src/lib/nhtsa.ts`, TSB/recall routes
- **Problem:** External calls depend on public/provider APIs; error handling and rate limits vary.
- **Impact:** Scanner/recall tabs can appear empty or fail without a clear reason.
- **Recommended fix:** Add structured `configured`/`error` states, timeouts, and cached fallbacks.
- **Effort:** M
- **Confidence:** Unverified — needs runtime.

### [AI-011] Estimate recomputation preserved negative model values
- **Severity:** P2
- **Area:** Estimate correctness
- **Evidence:** `src/app/api/ai/estimate/route.ts` (money coercion)
- **Problem:** The recomputation coerced numeric strings but did not clamp negatives. A model response with negative hours, quantity, price, or shop supplies produced a negative or nonsensical estimate.
- **Impact:** Staff could send a negative/incorrect estimate to a customer.
- **Reproduce / verify:** Mock a model response with `"hours": -2` or `"shopSupplies": -50`.
- **Recommended fix:** Clamp every monetary/quantity input to non-negative and default invalid quantities to 1.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [AI-012] Photo analysis constructed the Anthropic client at module scope
- **Severity:** P2
- **Area:** Error handling
- **Evidence:** `src/app/api/jobs/[id]/photos/analyze/route.ts`
- **Problem:** `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })` ran during route import. With no key configured, the SDK can throw before the handler returns its intended 503, producing an opaque 500.
- **Impact:** Photo analysis fails with a server error instead of a clear "not configured" message.
- **Reproduce / verify:** Unset `ANTHROPIC_API_KEY` and POST to the photo-analysis route.
- **Recommended fix:** Instantiate the client inside the handler after the key check.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

## What already works well
- AI endpoints return `503` when `ANTHROPIC_API_KEY` is missing instead of faking output.
- Rate limits exist per IP.
- Streaming diagnosis is implemented for the technician UI.
- AI estimate line math is now server-recomputed.
- Job-note writes are ownership-checked for technicians.

## Cross-section references
- Job ownership: `03-jobs-dispatch-tech.md` / JOBS-001.
- Rate limiting: `01-auth-security.md` / AUTH-009.
- Privacy policy: `05-customer-portal-public.md`.

## Verification commands / limitations
- `npm run type-check`, `npm run lint`, `npm test -- --run` — clean.
- No `ANTHROPIC_API_KEY` is configured, so all AI output and model IDs are `Unverified — needs runtime`.
- NHTSA/TSB calls were not exercised.
