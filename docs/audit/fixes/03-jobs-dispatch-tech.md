# Fix Workspace - Jobs, Dispatch & Tech

- **Status:** PARTIAL
- **Audit report:** ../03-jobs-dispatch-tech.md
- **Objective:** Fix and verify every open finding in the linked report. Do not re-audit unrelated sections.

## Already fixed in the parent pass
Tech job ownership, notes/photos/timelog/signature checks, timezone, limits, inspection email.

## Open work
Status transition matrix, concurrency-safe numbers, audit for subroutes, shop scoping.

## Exit criteria
All job subroutes enforce ownership; invalid transitions return 409; tests cover tech A/B.

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

