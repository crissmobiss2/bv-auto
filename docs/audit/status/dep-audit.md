# Status update — dependency audit (branch `devin/*-dep-audit`)

- **QUAL-010 (partial)**: `npm audit --omit=dev` went from 11 findings (3 critical, 7 high) to 7 (0 critical, 3 high, 4 moderate):
  - `next`/`eslint-config-next` 16.3.7 → 16.4.3
  - `@capacitor/*` → ^8.5.3
  - `zod` → ^4.6.7
  - overrides: `undici` ^6.29.1, `follow-redirects` ^1.16.2, `source-map-js` ^1.2.2

  What remains comes from CLI tooling: `deepmerge-ts` via the Prisma CLI config (needs Prisma 8), `uuid` via `@capacitor/cli`→`xcode`, and `fast-uri`. Still open: an `npm audit` step in CI. That waits until the CI workflow from the platform PR is merged, to avoid conflicting edits.
