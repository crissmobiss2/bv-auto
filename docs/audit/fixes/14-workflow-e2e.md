# Fix Workspace - End-to-End Workflow

- **Status:** PARTIAL
- **Audit report:** ../14-workflow-e2e.md
- **Objective:** Fix and verify every open finding in the linked report. Do not re-audit unrelated sections.

## Already fixed in the parent pass
Quote-approval-invoice-payment honest; approved-quote gate; balance-aware payments.

## Open work
Booking confirmation, completion-invoice-review, parts state, deposits, refunds, reminders, cancellation, supplemental quotes.

## Exit criteria
A customer can book-approve-pay-review without staff workarounds; refunds/deposits work.

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

