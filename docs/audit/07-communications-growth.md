# 07 — Communications, Marketing & Growth Audit

## Verdict
**Ship with fixes.** The biggest communication defect was a pattern of returning success without sending anything, plus a hard-coded fake SMS number. Quote/review/invoice/reset/sequence/overdue flows now fail honestly and use real configured channels. Consent/opt-out enforcement, delivery status, and durable rate limiting remain open.

## Scorecard
| Dimension | Grade | Notes |
|---|---|---|
| Correctness | B | No more fake success; sends throw on provider errors. |
| Security & tenant isolation | B- | Webhook signatures added; no shop scoping. |
| Data integrity | B- | Message records are written only after send (mostly). |
| Error handling | B | Real 502/503; UI still uses `alert()` in places. |
| UX & accessibility | B- | Templates are readable; no delivery status in UI. |
| Performance | B- | Cron batches; in-memory limits. |
| Maintainability | B- | Email/SMS helpers centralize escaping and config checks. |

## Coverage matrix
| Item | Type | Result | Notes |
|---|---|---|---|
| `src/lib/email.ts` | lib | PASS | Escaping, throwing send, config check. |
| `src/lib/sms.ts` | lib | PASS | No fake number; requires SID/token/phone. |
| Quote send | API | PASS | Marks SENT only on real delivery. |
| Invoice send | API | PASS | Real channel result; portal link. |
| Review request send | API | PASS | Requires phone + SMS. |
| Reset request | API | PASS | Requires Resend; 502 on failure. |
| Cron reviews | API | PASS | Real sends; no advance on failure. |
| Cron maintenance | API | PASS | Dedupes new follow-ups; no fake sends. |
| Cron overdue | API | PASS | Portal link; real channel checks. |
| Cron sequences | API | PASS | Does not advance on failed SMS. |
| Inbound SMS webhook | API | PASS | Twilio signature + dedupe. |
| Marketing campaigns | Page/API | PARTIAL | CRUD works; consent/opt-out not enforced. |
| Delivery status | Integration | FAIL | No Resend/Twilio status callbacks. |

## Findings

### [COMM-001] Quote send reported success without sending
- **Severity:** P1
- **Area:** Sales workflow
- **Evidence:** `src/app/api/quotes/[id]/send/route.ts`
- **Problem:** The route marked the quote `SENT`, set `sentAt`, and generated an approval token even when email and SMS were unconfigured or failed.
- **Impact:** Staff believed the customer received the quote; the pipeline stalled silently.
- **Reproduce / verify:** Send a quote with no `RESEND_API_KEY`/Twilio.
- **Recommended fix:** Attempt configured channels; only mark `SENT` if at least one succeeds; return `503`/`502` with the real error; do not create an approval token on failure.
- **Effort:** M
- **Confidence:** Confirmed — fixed in this pass.

### [COMM-002] Review request reported success without sending
- **Severity:** P1
- **Area:** Reputation workflow
- **Evidence:** `src/app/api/reviews/route.ts` / review send route
- **Problem:** The route set `sentAt` and returned success without a phone number or SMS configuration.
- **Impact:** No review requests were delivered, but reports showed them as sent.
- **Reproduce / verify:** Send a review request to a customer with no phone.
- **Recommended fix:** Require phone + `smsConfigured`; only set `sentAt` after `sendSms` resolves; return `400`/`503`.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [COMM-003] Sequence cron advanced after a failed SMS
- **Severity:** P1
- **Area:** Marketing automation
- **Evidence:** `src/app/api/cron/sequences/route.ts`
- **Problem:** The sequence step was advanced even when the SMS send failed, so the customer skipped the message permanently.
- **Impact:** Lost follow-ups and broken drip campaigns.
- **Reproduce / verify:** Force `sendSms` to throw and run the cron.
- **Recommended fix:** Advance only on success; leave the enrollment at the current step on failure and retry next run.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [COMM-004] Overdue reminders were fake and linked staff to a staff page
- **Severity:** P1
- **Area:** Collections
- **Evidence:** `src/app/api/cron/overdue/route.ts`
- **Problem:** The cron logged “sent” without a provider, and the payment link was a staff invoice URL the customer could not open.
- **Impact:** No collections contact; broken link if the customer did receive it.
- **Reproduce / verify:** Run overdue cron with no email/SMS config.
- **Recommended fix:** Require a configured channel; use the customer portal token; do not update `lastReminderAt` unless a send succeeds.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [COMM-005] Password reset returned success without email
- **Severity:** P1
- **Area:** Account recovery
- **Evidence:** `src/app/api/auth/reset-request/route.ts`
- **Problem:** Without `RESEND_API_KEY`, the route still returned success, so users waited for an email that would never arrive.
- **Impact:** Locked-out users cannot recover; support load.
- **Reproduce / verify:** Request a reset with no email key.
- **Recommended fix:** Return `503` when email is unconfigured; return `502` on provider failure.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [COMM-006] SMS helper fell back to a fake `+15550001000` number
- **Severity:** P1
- **Area:** Customer contact
- **Evidence:** `src/lib/sms.ts` (pre-fix)
- **Problem:** When `TWILIO_PHONE_NUMBER` was unset, the helper used a fake placeholder number. `smsConfigured` also did not require a phone number.
- **Impact:** Sends either failed at Twilio or came from an invalid number; UI thought SMS was available.
- **Reproduce / verify:** Unset `TWILIO_PHONE_NUMBER` and call `sendSms`.
- **Recommended fix:** Remove the fallback; require SID, token, and phone number; throw a clear configuration error.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [COMM-007] Inbound SMS webhook had no signature validation
- **Severity:** P1
- **Area:** Webhook integrity
- **Evidence:** `src/app/api/sms/webhook/route.ts:5`
- **Problem:** Anyone could POST fake inbound messages/STOP replies.
- **Impact:** Consent corruption and thread pollution.
- **Recommended fix:** Validate `X-Twilio-Signature` with the auth token and exact public URL; dedupe by `MessageSid`.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [COMM-008] STOP/opt-out is not enforced
- **Severity:** P2
- **Area:** Compliance
- **Evidence:** `src/lib/sms.ts`, `src/app/api/sms/webhook/route.ts`, campaign/sequence sends
- **Problem:** Inbound messages are stored, but there is no `smsOptOut` flag and no check before marketing/sequence sends.
- **Impact:** TCPA/consent risk and customer complaints.
- **Reproduce / verify:** Send “STOP” to the Twilio number, then trigger a sequence.
- **Recommended fix:** Parse STOP/START/HELP, store consent state per customer/phone, and block non-transactional sends when opted out.
- **Effort:** M
- **Confidence:** Confirmed.

### [COMM-009] No delivery-status callbacks
- **Severity:** P2
- **Area:** Reliability
- **Evidence:** `src/lib/email.ts`, `src/lib/sms.ts`
- **Problem:** Resend/Twilio accepted the request, but there is no webhook for delivered/bounced/failed; `SmsMessage` has no status field update path.
- **Impact:** “Sent” can still mean “accepted by provider”, not delivered; bounces are invisible.
- **Recommended fix:** Add status callbacks and store provider message IDs/status; surface failures in the customer timeline.
- **Effort:** M
- **Confidence:** Confirmed.

### [COMM-010] Email templates interpolated user data without escaping
- **Severity:** P1
- **Area:** HTML injection
- **Evidence:** `src/lib/email.ts` (pre-fix), quote/invoice/inspection/receipt templates
- **Problem:** Customer names, vehicle fields, line items, notes, and titles were inserted into HTML unescaped.
- **Impact:** HTML/script injection in email clients and the inspection preview.
- **Reproduce / verify:** Use a customer name containing `<script>`.
- **Recommended fix:** Add `escapeHtml` and apply it to every dynamic text field; keep numbers numeric.
- **Effort:** M
- **Confidence:** Confirmed — fixed in this pass.

### [COMM-011] Marketing campaigns do not check consent or audience exclusions
- **Severity:** P2
- **Area:** Growth compliance
- **Evidence:** `src/app/api/marketing/campaigns/route.ts`, campaign send flow
- **Problem:** Campaigns can target all customers with an email/phone; there is no opt-out, suppression list, or “do not market” flag.
- **Impact:** Spam complaints and legal exposure.
- **Recommended fix:** Add consent/suppression fields and filter the audience; record the exact recipient set for each send.
- **Effort:** M
- **Confidence:** Confirmed.

### [COMM-012] Communication rate limits are per instance
- **Severity:** P2
- **Area:** Abuse/cost
- **Evidence:** `src/lib/rate-limit.ts:1`
- **Problem:** AI, reset, booking, and portal-message limits reset per lambda instance.
- **Impact:** SMS/email cost abuse under horizontal scaling.
- **Recommended fix:** Use a shared Redis/KV limiter for any endpoint that can trigger a paid send.
- **Effort:** M
- **Confidence:** Confirmed.

### [COMM-013] Error UX relies on `alert()`
- **Severity:** P3
- **Area:** UX
- **Evidence:** quote send, text-to-pay, inspection send pages
- **Problem:** Provider failures are surfaced with browser `alert()` or a small inline line.
- **Impact:** Poor mobile experience; easy to miss.
- **Recommended fix:** Use the existing toast/dialog system with a retry action and a link to settings.
- **Effort:** S
- **Confidence:** Confirmed.

### [COMM-014] Overdue reminders still linked customers to a staff page
- **Severity:** P2
- **Area:** Customer communication
- **Evidence:** `src/app/api/cron/overdue/route.ts`
- **Problem:** The overdue cron used the customer portal only when a `portalToken` already existed; otherwise it emailed the staff `/invoices/[id]` URL, which a customer cannot open.
- **Impact:** Overdue reminders sent customers to a login wall and made it harder to pay.
- **Reproduce / verify:** Run the overdue cron for a customer without a portal token and inspect the email link.
- **Recommended fix:** Create a portal token on first overdue reminder, matching the invoice-send behavior.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [COMM-015] Review-request email did not escape the customer name
- **Severity:** P2
- **Area:** Email injection / stored XSS
- **Evidence:** `src/app/api/cron/reviews/route.ts` (HTML template)
- **Problem:** The review email interpolated `job.customer.firstName` directly into HTML, unlike the other templates that now use `escapeHtml`.
- **Impact:** A customer name containing HTML could break or inject into the review email.
- **Reproduce / verify:** Set a customer first name to `<img src=x onerror=...>` and run the review cron.
- **Recommended fix:** Escape the name before interpolation.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

## What already works well
- Email/SMS helpers now have a single configuration check and throw on missing providers.
- Quote, invoice, review, reset, sequence, maintenance, and overdue flows no longer claim success without a channel.
- Inbound SMS is signature-verified and deduplicated.
- Email templates escape dynamic HTML.
- Notification records are created only around real sends.

## Cross-section references
- Webhook auth: `01-auth-security.md` / AUTH-007.
- Review URL: `05-customer-portal-public.md` / PORT-010.
- Consent/tenant data: `10-database-data-integrity.md` / DATA-001.

## Verification commands / limitations
- `npm run type-check`, `npm run lint`, `npm test -- --run` — clean.
- Email/SMS delivery is `Unverified — needs runtime` because `RESEND_API_KEY` and `TWILIO_*` are unset.
- STOP/START behavior cannot be tested without a Twilio number.
