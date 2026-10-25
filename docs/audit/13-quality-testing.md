# 13 — Quality, Testing, Types & Build Audit

## Verdict
**Ship with fixes.** The codebase type-checks, lints, tests, and builds cleanly, which is better than many small-shop apps. The quality gap is coverage: 10 unit tests for ~134 API routes and 56 pages, no authz/tenant tests, no E2E, and no integration test for the money/communication flows that were just fixed.

## Scorecard
| Dimension | Grade | Notes |
|---|---|---|
| Correctness | B | Build/type/lint clean; runtime flows lightly tested. |
| Security & tenant isolation | C+ | No authz regression tests. |
| Data integrity | B- | Money/webhook tests exist but are narrow. |
| Error handling | B- | Validation is common; some routes still throw. |
| UX & accessibility | B- | No automated a11y checks. |
| Performance | B- | No load tests. |
| Maintainability | B | Consistent Next/Prisma/Zod patterns. |

## Coverage matrix
| Item | Type | Result | Notes |
|---|---|---|---|
| `npm run type-check` | check | PASS | Clean. |
| `npm run lint` | check | PASS | Clean. |
| `npm test -- --run` | tests | PASS | 4 files / 14 tests (merged tree). |
| `npm run build` | build | PASS | 130 pages generated. |
| Auth/RBAC tests | tests | FAIL | None. |
| Stripe/payment tests | tests | PARTIAL | Webhook happy path. |
| Email/SMS tests | tests | FAIL | None. |
| E2E browser tests | tests | FAIL | None. |
| API contract docs | docs | FAIL | None. |
| Error boundaries | UI | PARTIAL | Not consistently present. |

## Findings

### [QUAL-001] Test coverage is very thin for the surface area
- **Severity:** P2
- **Area:** Regression risk
- **Evidence:** `src/__tests__/` (4 files, 14 tests); ~134 API routes / 56 pages
- **Problem:** Only a handful of units are tested. Critical flows (authz, payments, quote approval, invoice send, payroll, portal tokens) have no tests.
- **Impact:** Regressions ship silently; the audit fixes are protected only by types.
- **Reproduce / verify:** `npm test -- --run --coverage` (no meaningful coverage).
- **Recommended fix:** Add route-level tests for authz and money paths; target 60%+ on `src/app/api` and `src/lib`.
- **Effort:** L
- **Confidence:** Confirmed.

### [QUAL-002] No authorization/tenant regression tests
- **Severity:** P2
- **Area:** Security testing
- **Evidence:** test folder
- **Problem:** The P0/P1 auth bugs were found by manual inspection, not tests. Nothing prevents a future route from using `requireAuth` where `requireRole` is needed.
- **Impact:** Role-boundary regressions.
- **Recommended fix:** Add a table-driven test that calls every route with each role and asserts 401/403/200; add a proxy unit test for allowlists.
- **Effort:** M
- **Confidence:** Confirmed.

### [QUAL-003] No end-to-end or browser tests
- **Severity:** P2
- **Area:** Workflow testing
- **Evidence:** no Playwright/Cypress config
- **Problem:** Mobile job flow, quote→invoice→payment, portal, and booking are only manually verified.
- **Impact:** Broken links/buttons reach production.
- **Recommended fix:** Add Playwright smoke tests for login, New Job, quote approval, invoice payment (mocked), and portal.
- **Effort:** M
- **Confidence:** Confirmed.

### [QUAL-004] Inconsistent try/catch and error mapping
- **Severity:** P2
- **Area:** Error handling
- **Evidence:** API routes (e.g., job notes before fix, invoice/quote routes)
- **Problem:** Some handlers let Prisma/provider errors bubble to a generic 500; others catch and return `apiError`. Invalid foreign keys and malformed dates become 500s.
- **Impact:** Poor UX and noisy logs.
- **Recommended fix:** Add a `withApiHandler` wrapper that maps Zod/Prisma/provider errors to 400/404/409/502 and logs correlation IDs.
- **Effort:** M
- **Confidence:** Confirmed.

### [QUAL-005] Validation style is mixed
- **Severity:** P2
- **Area:** Consistency
- **Evidence:** Zod in some routes, raw `req.json()` in others
- **Problem:** Some routes validate every field; others trust the body. Mass assignment was a direct result.
- **Impact:** Security and data-quality gaps.
- **Recommended fix:** Require a Zod schema for every mutating route; add a lint/review checklist item.
- **Effort:** M
- **Confidence:** Confirmed.

### [QUAL-006] Error boundaries are incomplete
- **Severity:** P2
- **Area:** Resilience
- **Evidence:** `src/app` (few/no `error.tsx` files)
- **Problem:** A render error can blank a route instead of showing a recoverable UI.
- **Impact:** Users see a white screen; no retry.
- **Recommended fix:** Add route-group `error.tsx` and a global error boundary with a reload/retry action.
- **Effort:** S
- **Confidence:** Confirmed.

### [QUAL-007] Offline replay dead code / inconsistent storage
- **Severity:** P3
- **Area:** Maintainability
- **Evidence:** `src/lib/offline-queue.ts`
- **Problem:** The queue uses localStorage while a replay helper references IndexedDB; dead/duplicated paths make behavior hard to reason about.
- **Impact:** Offline bugs are harder to fix.
- **Recommended fix:** Keep one storage implementation, delete dead code, and add unit tests for enqueue/flush.
- **Effort:** S
- **Confidence:** Confirmed.

### [QUAL-008] Vite config emits a CJS/ESM warning
- **Severity:** P3
- **Area:** Tooling
- **Evidence:** `vitest.config.ts:1`, test output
- **Problem:** Vite warns that ESM syntax is loaded as CommonJS.
- **Impact:** Future Vite versions may break the test runner.
- **Recommended fix:** Rename to `vitest.config.mts` or set `"type": "module"` in the appropriate package.
- **Effort:** S
- **Confidence:** Confirmed.

### [QUAL-009] No API contract/OpenAPI documentation
- **Severity:** P2
- **Area:** Maintainability
- **Evidence:** repo docs
- **Problem:** 134 routes have no machine-readable contract; mobile/desktop clients depend on implicit shapes.
- **Impact:** Integration drift and onboarding cost.
- **Recommended fix:** Generate an OpenAPI spec from Zod schemas or add route-level docs.
- **Effort:** M
- **Confidence:** Confirmed.

### [QUAL-010] No dependency/security audit in CI
- **Severity:** P2
- **Area:** Supply chain
- **Evidence:** `.github/workflows/ci.yml`
- **Problem:** CI does not run `npm audit`, Dependabot, or a lockfile integrity check.
- **Impact:** Known vulnerabilities can persist.
- **Recommended fix:** Add `npm audit --omit=dev` (non-blocking initially), Dependabot, and a lockfile check.
- **Effort:** S
- **Confidence:** Confirmed.

### [QUAL-011] Build/test health is currently good
- **Severity:** P3 (positive)
- **Area:** Baseline
- **Evidence:** `npm run type-check`, `npm run lint`, `npm test -- --run`, `npm run build`
- **Problem:** None.
- **Impact:** Safe baseline for incremental fixes.
- **Recommended fix:** Keep these as required checks on `master`.
- **Effort:** S
- **Confidence:** Confirmed.

## What already works well
- Strict TypeScript across the app; no `any`-driven compile failures.
- ESLint is clean.
- Zod is used for most complex inputs.
- Stripe webhook tests cover the paid path and a duplicate delivery (no second payment).
- Production build completes with 130 static pages.
- Prisma schema validates.

## Cross-section references
- CI branch mismatch: `11-platform-infra.md` / PLAT-003.
- Authz gaps: `01-auth-security.md`.
- Money tests: `04-billing-payments.md`.

## Verification commands / limitations
- `npm run type-check` — clean.
- `npm run lint` — clean.
- `npm test -- --run` — 4 files / 14 tests passing (merged tree).
- `npm run build` — clean.
- No coverage tool configured; coverage percentages are not available.
