# Fix Workspace - Parts & Inventory

- **Status:** PARTIAL
- **Audit report:** ../06-parts-inventory.md
- **Objective:** Fix and verify every open finding in the linked report. Do not re-audit unrelated sections.

## Already fixed in the parent pass
Parts PATCH whitelist, parts-only markup (prior), inventory search.

## Open work
Vendor/PO whitelists, shop scoping, PO receiving, inventory ledger, price bounds, provider error states.

## Exit criteria
Stock cannot go negative; PO receipt updates stock; vendor/PO inputs are validated.

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

