# Fix Workspace - Billing & Payments

- **Status:** PARTIAL
- **Audit report:** ../04-billing-payments.md
- **Objective:** Fix and verify every open finding in the linked report. Do not re-audit unrelated sections.

## Already fixed in the parent pass
Stripe idempotency/partials, overpay/void guards, approved-quote gate, send truthfulness, PDF escaping, plan ownership.

## Open work
Refund/void reversal, deposits, expired Stripe session refresh, manual idempotency key.

## Exit criteria
Refund and deposit flows are transactional; reports reconcile; Stripe test-mode webhook passes.

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

