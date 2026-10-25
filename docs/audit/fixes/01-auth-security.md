# Fix Workspace - Auth & Security

- **Status:** PARTIAL
- **Audit report:** ../01-auth-security.md
- **Objective:** Fix and verify every open finding in the linked report. Do not re-audit unrelated sections.

## Already fixed in the parent pass
Proxy allowlists, registration takeover, role gates, cron fail-closed, SMS signatures, job ownership.

## Open work
Tenant scoping, durable rate limits, session revocation, reset-token hashing, TOTP enumeration.

## Exit criteria
Every API route has an explicit role/ownership check; authz table test passes; no cross-shop read.

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

