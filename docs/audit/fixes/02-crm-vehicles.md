# Fix Workspace - CRM & Vehicles

- **Status:** PARTIAL
- **Audit report:** ../02-crm-vehicles.md
- **Objective:** Fix and verify every open finding in the linked report. Do not re-audit unrelated sections.

## Already fixed in the parent pass
Customer/vehicle mass-assignment whitelists, job vehicle/customer validation, export cost removal, dashboard count.

## Open work
Shop scoping, searchable customer picker, duplicate merge, VIN validation, CCPA request queue.

## Exit criteria
Customer/vehicle CRUD is shop-scoped; duplicate/merge flow exists; VIN validated.

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

