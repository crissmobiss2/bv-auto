# Fix Workspace - Portal & Public

- **Status:** PARTIAL
- **Audit report:** ../05-customer-portal-public.md
- **Objective:** Fix and verify every open finding in the linked report. Do not re-audit unrelated sections.

## Already fixed in the parent pass
Portal token POST auth, photo proxy, public tracking/redaction, message limits, real phone/review URL.

## Open work
Token expiry/rotation, tracking token, portal pay button, booking confirmation, review bot filtering.

## Exit criteria
Portal tokens expire/revoke; tracking requires a signed token; customer can pay from portal.

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

