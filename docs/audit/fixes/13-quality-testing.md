# Fix Workspace - Quality & Testing

- **Status:** OPEN
- **Audit report:** ../13-quality-testing.md
- **Objective:** Fix and verify every open finding in the linked report. Do not re-audit unrelated sections.

## Already fixed in the parent pass
Baseline type-check/lint/tests/build clean; Stripe webhook test updated.

## Open work
Authz table tests, E2E, money/integration tests, error wrapper, validation rule, error boundaries, OpenAPI, dependency audit.

## Exit criteria
CI enforces tests on master; authz and money regressions are covered.

## Required verification
```bash
npx prisma validate
npm run type-check
npm run lint
npm test -- --run
npm run build
```

## Rules
- One lane = one section. Do not duplicate another lane's finding.
- Add a test for every money/authz/ownership fix.
- Mark runtime-dependent items Unverified - needs runtime until the provider key is available.
- Record the exact files changed and commands run in this file before closing the lane.

