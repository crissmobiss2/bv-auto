# 00 — Executive Summary

## What was audited
- **Scope:** B&V Mobile Auto Next.js app at `C:\Users\christopher\Documents\bv-auto`.
- **Surface:** ~29,900 LOC, 134 API routes, 56 pages, 48 Prisma models, PWA service worker, Capacitor Android shell, Electron desktop shell.
- **Method:** Static code review of every route/page/lib in the 14 section scopes, authorization-matrix scan, money/communication flow tracing, schema/query review, and local verification. No production data was touched.
- **Baseline before fixes:** type-check, lint, 10 tests (3 files), and production build were clean on the original audit base `fb5d22b`.
- **After fixes:** the audit tree was merged onto current `master` (`5a99eb3`, 76 newer commits). On the merged tree, type-check, lint, 14 tests (4 files), and production build are clean.

## Overall verdict
**Ship with fixes for the current single-shop deployment. Do not onboard a second shop until tenant scoping is implemented.** The app’s core workflows are real and usable, and the highest-risk issues — customer account takeover, staff-API exposure to customers/technicians, duplicate Stripe payments, overpayment, fake send success, PDF XSS, and cross-technician job access — are fixed in this pass. The remaining risks are architectural (tenant isolation, durable rate limits, migrations), workflow completeness (refunds, deposits, inventory receiving, booking notifications), and mobile input/feedback quality.

## Integration with master (2026-10-25)
The audit was run on `fb5d22b`. Before committing, it was merged onto `master`, which already had ~40 later fix PRs. 20 files conflicted. They were resolved so both sides are kept:
- **Kept from master:** the shared `isCronAuthorized` helper (`src/lib/cron-auth.ts`), the transactional payment-plan "mark paid" flow (row lock, `Payment` rows, invoice reconciliation, legacy backfill), portal photo token links (`/api/photos/*?t=`), the `/reset` page, the review-link redirect page, and the quote delivery statuses (`emailStatus`/`smsStatus`).
- **Kept from the audit:** proxy default-deny role rules, fail-closed email/SMS (no fake send success, no fake Twilio number), Twilio webhook signature required, Stripe webhook dedupe and balance-based `PAID`/`PARTIAL`, HTML escaping, payroll CSV formula neutralization, collected-cash reporting, and the other route fixes listed in each section.
- **Code state:** every "fixed" claim below refers to code in this commit on `master`, not to an uncommitted tree.

## Finding counts
| Severity | Count | Fixed in this pass | Open |
|---|---:|---:|---:|
| P0 — Critical | 4 | 3 | 1 (tenant scoping) |
| P1 — High | 48 | ~33 | ~15 |
| P2 - Medium | 107 | ~32 | ~75 |
| P3 - Low | 20 | ~2 | ~18 |
| **Total** | **179** | **~70** | **~109** |

Counts are derived from the 14 reports; “fixed” means code changed and type-check/lint/tests pass, not that the integration was exercised live.

## Section scorecard
| # | Section | Grade | Verdict | Biggest remaining risk |
|---|---|---|---|---|
| 01 | Auth & security | C | Ship with fixes | Tenant isolation, durable rate limits |
| 02 | CRM & vehicles | C+ | Ship with fixes | No shop scoping, no merge/claim flow |
| 03 | Jobs, dispatch & tech | B- | Ship with fixes | No status state machine |
| 04 | Billing & payments | B- | Ship with fixes | Refunds/voids, Stripe session expiry |
| 05 | Portal & public | B- | Ship with fixes | Token expiry, tracking token |
| 06 | Parts & inventory | C+ | Ship with fixes | No movement ledger/receiving |
| 07 | Communications | B- | Ship with fixes | Consent/opt-out, delivery status |
| 08 | Reports & payroll | C+ | Ship with fixes | Period lock, CSV injection |
| 09 | AI & diagnostics | C+ | Ship with fixes | Model IDs, output schema, PII |
| 10 | Database & data | D+ | Do not multi-tenant yet | No `shopId`, no migrations |
| 11 | Platform & infra | B- | Ship with fixes | CI branch mismatch, APK signing |
| 12 | UX & accessibility | C+ | Ship with fixes | Input modes, error feedback |
| 13 | Quality & testing | C+ | Ship with fixes | Only 14 tests for 134 routes |
| 14 | End-to-end workflow | B- | Ship with fixes | Deposits, refunds, cancellations |

## Top risks fixed in this pass
1. **Customer account takeover via unverified email linking** — registration no longer attaches a new user to an existing customer by email (`AUTH-002`).
2. **Customer sessions could call staff APIs and open `/tech`** — default-deny proxy + customer allowlist (`AUTH-001`).
3. **Public booking list and public portal-token creation** — staff-only now (`AUTH-003`, `AUTH-004`, `PORT-001`).
4. **Technicians could reach payroll/reports/invoices and any job by ID** — role blocks + job ownership checks (`AUTH-005`, `AUTH-008`, `JOBS-001`).
5. **Stripe duplicate payments / partial marked paid** — paid-only, dedupe, serializable, balance-aware (`BILL-001`).
6. **Manual overpayment and payment-plan cross-invoice edits** — rejected/recomputed (`BILL-002`, `BILL-007`).
7. **Invoice from an unapproved quote** — approved-quote gate (`BILL-003`).
8. **Fake quote/invoice/review/text-to-pay/reset/sequence success** — real channel checks, 502/503 on failure (`COMM-001`–`COMM-006`).
9. **Fake `+15550001000` SMS number and `tel:+1` portal link** — removed (`COMM-006`, `PORT-009`).
10. **PDF/email/inspection stored XSS** — escaping applied (`BILL-006`, `COMM-010`, `JOBS-004`).
11. **Service worker cached authenticated API PII across users** — API caching removed, cache cleared on sign-out (`PLAT-001`, `PLAT-010`).
12. **Electron origin prefix bypass** — exact origin check (`PLAT-002`).
13. **Public tracking broken and leaking PII** — public, rate-limited, redacted (`PORT-003`).
14. **Review links pointed at a dead Google placeholder** — shop/env URL or honest 503 (`PORT-010`).
15. **AI estimate numeric concatenation** — coercion + recompute (`AI-001`).

## Top open risks (priority order)
1. **No tenant isolation** — most models lack `shopId`; every staff user can read all shops’ data. This is the only remaining P0 for a multi-shop future (`AUTH-010`, `DATA-001`).
2. **No refund/void reversal** - invoice totals and revenue stay wrong after refunds (`BILL-009`).
3. **No inventory movement ledger/receiving** — stock can go negative and POs can be “received” without updating inventory (`PART-004`, `PART-005`).
4. **No SMS consent/opt-out enforcement** — TCPA risk (`COMM-008`, `COMM-011`).
5. **No period lock for payroll** — historical pay changes silently (`FIN-006`).
6. **CI does not run on `master`; production uses `migrate deploy` with no migrations** — release/schema risk (`PLAT-003`, `PLAT-004`).
7. **Booking has no customer confirmation or staff alert** — leads can go stale (`PORT-011`, `FLOW-003`).
8. **No deposits** — deposit fields are decorative (`BILL-013`, `FLOW-006`).
9. **Only 14 tests for 134 routes** — authz/money regressions are unprotected (`QUAL-001`–`QUAL-003`).
10. **Mobile input ergonomics** — 39 number inputs, 0 `inputMode="decimal"`; inconsistent autocaps/autocorrect (`UX-002`, `UX-003`).
11. **APK is debug-signed** — in-place updates fail; requires release keystore (`PLAT-007`).
12. **Stripe session reuse can return an expired checkout** (`BILL-008`).

## Runtime blockers / what could not be proven
- **Production schema:** the audit adds no Prisma schema changes. On 2026-10-25, `prisma migrate diff` against Neon was empty and `npx prisma db push` reported "already in sync", so no tables or columns were created.
- **Email/SMS/Stripe/AI/parts integrations** are unset in this environment: `RESEND_API_KEY`, `TWILIO_*`, `STRIPE_*`, `ANTHROPIC_API_KEY`, `PARTSTECH_*`. All such findings are marked `Unverified — needs runtime` where behavior depends on them.
- **Subagent workspaces** could not be launched because the configured OpenRouter key is exhausted (`$10.00 of $10.00 used; does not reset`). The audit and fixes were performed directly in the parent session; the section reports and fix plan are still structured as independent lanes so they can be handed to subagents later.
- **APK** cannot silently overwrite the installed app because the signing key differs; one-time uninstall/reinstall is required.
- **No production data** was read or modified during the audit.

## Verification evidence
| Check | Command | Result |
|---|---|---|
| Prisma schema | `npx prisma validate` | Pass |
| TypeScript | `npm run type-check` | Pass |
| ESLint | `npm run lint` | Pass |
| Unit tests | `npm test -- --run` | 4 files / 14 tests pass (merged tree) |
| Production build | `npm run build` | Pass, 130 static pages |
| Local DB | Docker `bvauto-pg`, port 5433 | Running during audit |
| Production DB | Neon `prisma db push` | Already in sync; no changes |

## Mobile verification (390×844)
| Page | Result | Evidence |
|---|---|---|
| `/login` | PASS | Login form fits, no horizontal scroll; `mobile-login.png`. |
| `/dashboard` | PASS | KPI cards stack correctly; push prompt is dismissible; `mobile-dashboard.png`. |
| `/jobs/new` | PASS | Customer/vehicle/technician/date fields render; vehicle is gated until a customer is chosen; `mobile-new-job.png`. |
| `/tech` | PASS | “My Jobs”, empty states, bottom nav, and sign-out fit; `mobile-tech.png`. |
| `/book` (public) | PASS after fix | Push prompt no longer overlays the public form; `mobile-book-fixed.png`. |
| `/invoices`, `/customers`, `/payroll`, `/reports` | PASS | Headings, search/filter, export, and KPI cards render without console errors. |

The mobile run found and fixed three additional issues: CSP blocking Vercel Analytics (`PLAT-013`), the public push prompt (`UX-013`), and blank conversion KPIs on `/reports` (`FIN-012`). No console errors remained after the fixes.

## What “fixed” means here
A finding marked **fixed in this pass** means the code path was changed, the change compiles, lints, and does not break the existing tests. It does **not** mean the third-party integration was exercised live. Every integration-dependent fix is called out in its section’s limitations.

## Recommended next move
Follow `FIX-PLAN.md` in order: finish the remaining P1 workflow/data issues, add authz/money tests, then do the P2 UX/quality batch. Do the tenant-scoping design before adding a second shop.
