# 11 — Platform, Infra, PWA, Electron & CI Audit

## Verdict
**Ship with fixes.** Security headers, Sentry wiring, a CI workflow, PWA/offline support, Capacitor, and Electron are all present. The PWA was caching authenticated API payloads across users (fixed), the Electron origin check used a prefix match (fixed), and cache storage now clears on sign-out. The CI workflow targets `main` while the repo ships from `master`, and production still uses `db push` despite a `migrate deploy` step.

## Scorecard
| Dimension | Grade | Notes |
|---|---|---|
| Correctness | B | Build, PWA, Electron, and mobile shell work. |
| Security & tenant isolation | B- | CSP/headers good; `unsafe-inline`/`unsafe-eval` weaken script CSP. |
| Data integrity | B- | Cache privacy fixed; production schema process weak. |
| Error handling | B | Sentry configured; DSN may be unset. |
| UX & accessibility | B | PWA install/update flows exist. |
| Performance | B | Static asset caching; API caching now disabled. |
| Maintainability | B- | CI branch mismatch and migration mismatch. |

## Coverage matrix
| Item | Type | Result | Notes |
|---|---|---|---|
| `next.config.ts` headers | config | PASS | HSTS, CSP, frame, referrer, permissions. |
| `public/sw.js` | PWA | PASS | API caching removed; v4 cache. |
| `src/lib/offline-queue.ts` | PWA | PARTIAL | Replay works; user scoping missing. |
| `public/manifest.json` | PWA | PASS | Installable. |
| `capacitor.config.ts` | mobile | PASS | Loads production URL. |
| `electron/main.js` | desktop | PASS | Exact-origin check. |
| `.github/workflows/ci.yml` | CI | FAIL | Branches `main`/`develop`; repo uses `master`. |
| Production schema deploy | ops | FAIL | CI runs `migrate deploy` but no migrations exist. |
| Sentry | observability | PARTIAL | Config present; DSN/runtime unverified. |
| APK signing | mobile | FAIL | Debug-signed; signature mismatch on update. |

## Findings

### [PLAT-001] Service worker cached authenticated API responses across users
- **Severity:** P1
- **Area:** Shared-device privacy
- **Evidence:** `public/sw.js` (pre-fix), `CACHEABLE_API`
- **Problem:** API GETs (customers, jobs, invoices, dashboard) were cached and served offline. On a shared shop tablet, user B could receive user A’s cached PII after A signed out.
- **Impact:** Cross-user data exposure.
- **Reproduce / verify:** Sign in as A, load customer data, sign out, sign in as B offline.
- **Recommended fix:** Do not cache `/api/*` responses; bump the cache version; clear caches on sign-out.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [PLAT-002] Electron origin check used a prefix match
- **Severity:** P1
- **Area:** Desktop shell
- **Evidence:** `electron/main.js`
- **Problem:** Navigation/window-open checks compared `url.startsWith(APP_URL)`, so `https://bv-auto.vercel.app.evil.com` passed.
- **Impact:** Phishing/navigation escape from the trusted app origin.
- **Reproduce / verify:** Attempt to open a lookalike host from the Electron shell.
- **Recommended fix:** Compare `new URL(url).origin === new URL(APP_URL).origin`.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

### [PLAT-003] CI does not run on the shipping branch
- **Severity:** P1
- **Area:** Release safety
- **Evidence:** `.github/workflows/ci.yml` (`branches: [main, develop]`, `if: github.ref == 'refs/heads/main'`)
- **Problem:** The repository ships from `master` (recent commits/pushes are on `master`), but CI only triggers on `main`/`develop`. Pushes to `master` bypass lint/typecheck/test/build/deploy gates.
- **Impact:** Broken code can reach production without CI.
- **Reproduce / verify:** Push a commit to `master` and observe no workflow run.
- **Recommended fix:** Add `master` to the trigger branches and the production deploy condition; or rename the default branch consistently.
- **Effort:** S
- **Confidence:** Confirmed.

### [PLAT-004] Production deploy runs `migrate deploy` with no migrations
- **Severity:** P1
- **Area:** Deploy/schema
- **Evidence:** `.github/workflows/ci.yml` (`npx prisma migrate deploy`), no `prisma/migrations/`
- **Problem:** The deploy job expects a migration history that does not exist. A fresh database would not be provisioned by this step, and schema changes still rely on manual `db push`.
- **Impact:** Deploy can succeed while the schema is stale; onboarding a new environment fails.
- **Reproduce / verify:** Run `npx prisma migrate deploy` against an empty database.
- **Recommended fix:** Baseline `prisma/migrations/0001_init`, switch local/prod to `migrate deploy`, and keep `db push` only for throwaway local DBs.
- **Effort:** M
- **Confidence:** Confirmed.

### [PLAT-005] CSP allows `unsafe-inline` and `unsafe-eval`
- **Severity:** P2
- **Area:** Browser security
- **Evidence:** `next.config.ts` (`script-src 'self' 'unsafe-inline' 'unsafe-eval'`)
- **Problem:** The CSP does not meaningfully mitigate script injection; `unsafe-eval` is especially broad.
- **Impact:** Any XSS becomes fully exploitable.
- **Recommended fix:** Move to nonce/hash-based scripts, remove `unsafe-eval` if no dependency requires it, and test Stripe/Sentry compatibility.
- **Effort:** M
- **Confidence:** Confirmed.

### [PLAT-006] Rate limiting and idempotency are process-local
- **Severity:** P2
- **Area:** Scale
- **Evidence:** `src/lib/rate-limit.ts:1`
- **Problem:** Limits reset per lambda instance; no shared store.
- **Impact:** Abuse/cost risk at scale.
- **Recommended fix:** Use Upstash Redis/Vercel KV for rate limits and idempotency keys.
- **Effort:** M
- **Confidence:** Confirmed.

### [PLAT-007] APK is debug-signed and cannot update in place
- **Severity:** P2
- **Area:** Mobile release
- **Evidence:** Android build output (`versionCode 4`, debug keystore)
- **Problem:** The installed APK and the new APK have different signing keys, so Android refuses the update; users must uninstall/reinstall.
- **Impact:** Lost local data and a confusing update path.
- **Reproduce / verify:** Install the old APK, then install the new one.
- **Recommended fix:** Create a release keystore, store it securely, sign all future APKs with it, and publish with a versioned upgrade path.
- **Effort:** M
- **Confidence:** Confirmed.

### [PLAT-008] Production `db:push` is blocked by missing `DATABASE_URL`
- **Severity:** P2
- **Area:** Deployment
- **Evidence:** `.env` currently points at local Docker Postgres; no Neon URL present
- **Problem:** The production schema cannot be pushed until the real connection string is provided.
- **Impact:** Production may be running an older schema.
- **Recommended fix:** Add the Neon pooled/unpooled URLs, run a reviewed migration, and verify the schema.
- **Effort:** S
- **Confidence:** Confirmed.

### [PLAT-009] Sentry is configured but runtime DSN is unverified
- **Severity:** P2
- **Area:** Observability
- **Evidence:** `next.config.ts` (`withSentryConfig`), CI secrets
- **Problem:** If `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` are unset in production, errors are invisible.
- **Impact:** Slow incident response.
- **Recommended fix:** Verify the DSN in production, add a release/health check, and alert on error rate.
- **Effort:** S
- **Confidence:** Unverified — needs runtime.

### [PLAT-010] Cache is cleared on sign-out, but offline queue is not
- **Severity:** P2
- **Area:** Shared-device privacy
- **Evidence:** `src/lib/sign-out.ts`, `src/lib/offline-queue.ts`
- **Problem:** `signOutAndClear()` deletes Cache Storage, but pending offline mutations remain in local storage and can replay under the next user.
- **Impact:** Cross-user writes.
- **Recommended fix:** Namespace and clear the offline queue on sign-out; include the user ID in each queued mutation and reject mismatches.
- **Effort:** S
- **Confidence:** Confirmed.

### [PLAT-011] No documented restore/backup drill
- **Severity:** P2
- **Area:** Operations
- **Evidence:** repo docs
- **Problem:** Backups depend on provider defaults; no restore has been tested.
- **Impact:** Extended downtime/data loss after a bad deploy.
- **Recommended fix:** Enable PITR, document RPO/RTO, and run a quarterly restore drill.
- **Effort:** S
- **Confidence:** Confirmed.

### [PLAT-012] PWA cache versioning is manual
- **Severity:** P3
- **Area:** Release hygiene
- **Evidence:** `public/sw.js` (`CACHE_VERSION`)
- **Problem:** The cache name must be bumped by hand; forgetting it leaves stale assets.
- **Recommended fix:** Inject the build ID into the service worker or generate the cache name at build time.
- **Effort:** S
- **Confidence:** Confirmed.

### [PLAT-013] CSP blocked Vercel Analytics and Speed Insights
- **Severity:** P2
- **Area:** Observability
- **Evidence:** `next.config.ts` (`script-src`, `connect-src`), browser console on `/login` and `/book`
- **Problem:** The CSP allowed `js.stripe.com` and `*.sentry.io` but not `https://va.vercel-scripts.com` or `https://vitals.vercel-insights.com`. The analytics scripts were blocked and no pageviews/vitals were sent.
- **Impact:** Production analytics and speed data silently missing; console errors on every page.
- **Reproduce / verify:** Load any page in a browser and inspect the console for CSP violations from `va.vercel-scripts.com`.
- **Recommended fix:** Allow the Vercel Analytics script origin in `script-src` and the insights origin in `connect-src`.
- **Effort:** S
- **Confidence:** Confirmed — fixed in this pass.

## What already works well
- Security headers are comprehensive (HSTS, CSP, frame denial, referrer, permissions).
- Sentry is wired into the Next build.
- PWA install/update banner and offline page exist.
- Capacitor loads the production web app, so web fixes propagate without an APK rebuild.
- Electron now uses exact-origin checks.
- CI includes lint, typecheck, build, test, preview, and production deploy jobs.

## Cross-section references
- Auth/rate limits: `01-auth-security.md` / AUTH-009.
- Offline queue: `10-database-data-integrity.md` / DATA-008.
- Mobile workflow: `03-jobs-dispatch-tech.md`.

## Verification commands / limitations
- `npm run build` — clean (130 static pages generated).
- `npm run type-check`, `npm run lint`, `npm test -- --run` — clean.
- APK signing and production `db:push` are blocked by missing credentials/keystore.
- Sentry and CI runtime status are `Unverified — needs runtime`.
