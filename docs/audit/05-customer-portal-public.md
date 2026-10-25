# 05 — Customer Portal, Booking, Tracking & Public Pages Audit

## Verdict
**Ship with fixes.** The public surface is small and mostly tokenized. The serious issues were a public portal-token POST, portal photos blocked by the auth proxy, a broken tracking page, a fake phone link, and a placeholder Google review URL. Those are fixed. Remaining gaps are token expiry/rotation, portal data minimization, and booking confirmations.

## Scorecard
| Dimension | Grade | Notes |
|---|---|---|
| Correctness | B | Portal, booking, tracking, review links now resolve for customers. |
| Security & tenant isolation | B | Tokenized access; no expiry/rotation; no shop scoping. |
| Data integrity | B | Booking creates real records; no duplicate detection. |
| Error handling | B | Public endpoints return real errors; some still fail silently. |
| UX & accessibility | B- | Mobile portal works; payment path is unclear. |
| Performance | B | Public endpoints are rate-limited (per instance). |
| Maintainability | B | Public allowlists are centralized in `proxy.ts`. |

## Coverage matrix
| Item | Type | Result | Notes |
|---|---|---|---|
| `/book` public booking | Page/API | PASS | POST public; GET staff-only. |
| `/api/shop-info` | API | PASS | Name/phone/email only, rate-limited. |
| `/portal/[token]` | Public page | PASS | Customer, vehicles, jobs, invoices. |
| `/api/portal/[token]` GET | API | PASS | Tokenized read. |
| `/api/portal/[token]` POST | API | PASS | Staff-only token creation. |
| `/api/portal/[token]/message` | API | PASS | Rate-limited, length-capped. |
| `/api/photos/[id]` | API | PASS | Session or portal token; safe MIME. |
| `/track` + `/api/tracking/job` | Public page/API | PASS | Public, rate-limited, PII removed. |
| `/review/[token]` | Public redirect | PASS | Uses shop/env URL; no fake fallback. |
| Customer layout phone link | UI | PASS | Real shop phone or hidden. |
| Portal token lifecycle | Security | FAIL | No expiry/revoke. |
| Portal payment button | Workflow | FAIL | No clear pay action. |

## Findings

### [PORT-001] Portal token creation was public
- **Severity:** P1
- **Area:** Public API
- **Evidence:** `src/app/api/portal/[token]/route.ts`
- **Problem:** POST created/returned a portal token without a session. Anyone who knew a customer ID could mint a link to that customer’s portal.
- **Impact:** Customer PII and invoice exposure.
- **Reproduce / verify:** POST `/api/portal/<customerId>` with no cookie.
- **Recommended fix:** Require `ADMIN`, `DISPATCHER`, or `SERVICE_ADVISOR`; keep the tokenized GET public.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [PORT-002] Portal photos were blocked by the auth proxy
- **Severity:** P1
- **Area:** Broken feature
- **Evidence:** `src/proxy.ts:18`, `src/app/api/photos/[id]/route.ts:17`
- **Problem:** `/api/photos` was not in the public API allowlist, so a customer opening a portal photo without a session was redirected/401’d before the route could validate `?t=<portalToken>`.
- **Impact:** Customers could not see inspection/job photos.
- **Reproduce / verify:** Open a portal photo URL in a private window.
- **Recommended fix:** Allow `/api/photos` through the proxy and keep the route’s session-or-portal-token check.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [PORT-003] Tracking was broken for customers and leaked customer data
- **Severity:** P1
- **Area:** Public tracking
- **Evidence:** `src/app/(public)/track/page.tsx`, `src/app/api/tracking/job/[jobId]/route.ts`, `src/proxy.ts:19`
- **Problem:** The tracking page and API were behind auth, so customers could not use the link; the API also returned customer name/phone and full job details.
- **Impact:** Feature unusable; unnecessary PII exposure.
- **Reproduce / verify:** Open `/track?job=<id>` without a session before the fix.
- **Recommended fix:** Make `/track` and `/api/tracking/job` public, rate-limit them, and return only status/ETA/vehicle/technician display fields.
- **Effort:** M
- **Confidence:** Confirmed — fixed in this pass.

### [PORT-004] Portal tokens never expire or rotate
- **Severity:** P2
- **Area:** Token lifecycle
- **Evidence:** `prisma/schema.prisma` (`Customer.portalToken`), `src/app/api/portal/[token]/route.ts`
- **Problem:** One permanent token per customer; no expiry, revocation, or rotation after sensitive changes.
- **Impact:** A forwarded/leaked link works forever.
- **Reproduce / verify:** Generate a token, wait indefinitely, reopen the link.
- **Recommended fix:** Add `portalTokenExpiresAt`, rotate on demand, and allow staff to revoke; consider short-lived signed links.
- **Effort:** M
- **Confidence:** Confirmed.

### [PORT-005] Portal GET returns more customer data than needed
- **Severity:** P2
- **Area:** Data minimization
- **Evidence:** `src/app/api/portal/[token]/route.ts`
- **Problem:** The response includes broad customer fields (address, tax flags, internal IDs) and job/invoice relations. Only `notes` is stripped.
- **Impact:** Extra PII in the public response and browser cache.
- **Reproduce / verify:** Inspect the JSON returned by `/api/portal/<token>`.
- **Recommended fix:** Select only customer-facing fields; omit internal flags, `portalToken`, `shopId`, and staff-only notes.
- **Effort:** S
- **Confidence:** Confirmed.

### [PORT-006] Portal messages had no rate limit or length cap
- **Severity:** P2
- **Area:** Abuse
- **Evidence:** `src/app/api/portal/[token]/message/route.ts:5`
- **Problem:** Anyone with a portal token could create unlimited `SmsMessage` rows and trigger unlimited shop SMS notifications; `body` had no maximum.
- **Impact:** Database spam and SMS cost.
- **Reproduce / verify:** POST 1,000 messages with the same token.
- **Recommended fix:** Rate-limit per token+IP, cap body at 2,000 chars, and only notify the shop when Twilio is configured.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [PORT-007] Portal message notification is optional and silent
- **Severity:** P2
- **Area:** Communication
- **Evidence:** `src/app/api/portal/[token]/message/route.ts:27`
- **Problem:** If `SHOP_NOTIFY_PHONE` or Twilio is unset, the message is stored but the shop is never notified; the customer sees success.
- **Impact:** Messages sit unseen in the dashboard.
- **Recommended fix:** Show the message in the staff notification feed (it already is a record) and/or send an email; label the portal as “message sent to the shop” only when a channel succeeds.
- **Effort:** S
- **Confidence:** Confirmed.

### [PORT-008] Tracking link uses a raw job ID with no token
- **Severity:** P2
- **Area:** Access control
- **Evidence:** `src/app/(public)/track/page.tsx`, `/api/tracking/job/[jobId]`
- **Problem:** Anyone who obtains/guesses a job CUID can track that job; there is no per-customer token or expiry.
- **Impact:** Job status/vehicle/location exposure.
- **Reproduce / verify:** Open `/track?job=<any-job-id>`.
- **Recommended fix:** Issue a signed tracking token (or reuse the portal token) and validate it; rate-limit by token.
- **Effort:** M
- **Confidence:** Confirmed.

### [PORT-009] Customer layout used a fake `tel:+1` link
- **Severity:** P2
- **Area:** UX / trust
- **Evidence:** `src/app/(customer)/layout.tsx` (pre-fix)
- **Problem:** The phone icon linked to `tel:+1`, which dials an invalid number. This is the same class of fake contact data the shop explicitly wanted removed.
- **Impact:** Customers cannot call the shop from the portal; looks broken.
- **Reproduce / verify:** Tap the phone icon on a phone.
- **Recommended fix:** Fetch `/api/shop-info` and render `tel:<real number>`; hide the icon if no number is configured.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [PORT-010] Review redirect used a placeholder Google URL
- **Severity:** P2
- **Area:** Reputation workflow
- **Evidence:** `src/app/api/review/[token]/route.ts:4`
- **Problem:** `GOOGLE_REVIEW_URL` defaulted to `https://g.page/r/review`, a dead/placeholder page. Customers who clicked a review request were sent nowhere useful.
- **Impact:** Lost reviews and a broken customer experience.
- **Reproduce / verify:** Open `/review/<token>` with `GOOGLE_REVIEW_URL` unset.
- **Recommended fix:** Use `Shop.googleReviewUrl` or `GOOGLE_REVIEW_URL`; if neither is set, return a clear 503 instead of redirecting to a fake page.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [PORT-011] Booking has no confirmation or staff notification
- **Severity:** P2
- **Area:** Lead workflow
- **Evidence:** `src/app/api/booking/route.ts`, booking page
- **Problem:** A public booking creates a record but does not email/SMS the customer or push/notify staff. The customer sees a generic success.
- **Impact:** Leads can sit unnoticed; customers are unsure the request was received.
- **Recommended fix:** Send a confirmation email/SMS (if configured) and a staff push/email; show the reference number to the customer.
- **Effort:** M
- **Confidence:** Confirmed.

### [PORT-012] Review GET marks any token as clicked
- **Severity:** P3
- **Area:** Analytics integrity
- **Evidence:** `src/app/api/review/[token]/route.ts:9`
- **Problem:** The route updates `clickedAt` if the token exists, regardless of whether the request came from the customer or a link scanner/preview bot.
- **Impact:** Inflated click metrics.
- **Recommended fix:** Only mark on a user-agent that looks like a browser, or track clicks client-side on the review landing page.
- **Effort:** S
- **Confidence:** Likely.

## What already works well
- Booking POST is public while the booking list is staff-only.
- Portal access is tokenized and scoped to one customer.
- Portal photos work with `?t=<portalToken>` and now serve safe MIME types.
- Tracking is public, rate-limited, and no longer returns customer PII.
- Shop contact info is exposed only through a minimal public endpoint.
- Review sends now require SMS configuration and only set `sentAt` after delivery.

## Cross-section references
- Registration/claim: `01-auth-security.md` / AUTH-002.
- Invoice portal link: `04-billing-payments.md` / BILL-004.
- Review cron: `07-communications-growth.md` / COMM-002.

## Verification commands / limitations
- `npm run type-check`, `npm run lint`, `npm test -- --run` — clean.
- Public pages were checked at a mobile viewport; real SMS/email links require production keys.
- Portal token expiry cannot be tested because the field does not exist yet.
