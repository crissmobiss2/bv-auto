# Fix Workspace - Communications & Growth

- **Status:** PARTIAL
- **Audit report:** ../07-communications-growth.md
- **Objective:** Fix and verify every open finding in the linked report. Do not re-audit unrelated sections.

## Already fixed in the parent pass
No fake sends, real config checks, escaping, webhook signature/dedupe, sequence no-advance-on-failure.

## Open work
STOP/START consent, campaign suppression, delivery status callbacks, shared rate limits, toast UX.

## Exit criteria
Opted-out customers are never messaged; delivery/bounce status is visible; paid sends are rate-limited.

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

