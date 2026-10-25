# Fix Workspace - Database & Data Integrity

- **Status:** OPEN
- **Audit report:** ../10-database-data-integrity.md
- **Objective:** Fix and verify every open finding in the linked report. Do not re-audit unrelated sections.

## Already fixed in the parent pass
No schema changes were made in this pass; local schema validates.

## Open work
Tenant shopId, migrations baseline, inventory ledger, payment external ID, customer merge, offline queue scoping, backups.

## Exit criteria
Migrations deploy cleanly; tenant queries are enforced; restore drill passes.

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

