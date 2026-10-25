# Fix Workspace - Reports, Payroll & Accounting

- **Status:** PARTIAL
- **Audit report:** ../08-reports-payroll-accounting.md
- **Objective:** Fix and verify every open finding in the linked report. Do not re-audit unrelated sections.

## Already fixed in the parent pass
Role gates, shop-timezone dashboard, owner/tech payroll, CSV export exists.

## Open work
Tenant scoping, CSV injection, period lock, refund-aware revenue, accounting idempotency, OT rules.

## Exit criteria
Payroll is a locked snapshot; CSV is safe; reports use one revenue source.

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

