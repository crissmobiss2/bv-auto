# AUTH-010 / DATA-001: single-shop lock (option B)

Decision (owner, 2026-10-26): run one shop for now instead of full multi-shop tenant scoping.

- `POST /api/shops` creates a shop only when none exists (count + create under `pg_advisory_xact_lock(724002)`), and makes it the default. A second shop gets 409.
- The only shop can't be deactivated (`DELETE /api/shops/[id]` and `PATCH { isActive: false }` return 409).
- Shops page hides "Add Shop" once a shop exists and drops "Remove". Onboarding updates the existing shop instead of failing.

Status: AUTH-010 / DATA-001 are **mitigated for single-shop**, not fixed. Customer, vehicle, invoice, quote, part, vendor and report queries are still global. Before adding a second shop or location, add `shopId` to those models, backfill, and scope every query (option A).

Verified locally: type-check, lint, tests (`single-shop.test.ts`), build. Not tested in a browser.
