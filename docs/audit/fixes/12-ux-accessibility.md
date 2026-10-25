# Fix Workspace - UX & Accessibility

- **Status:** PARTIAL
- **Audit report:** ../12-ux-accessibility.md
- **Objective:** Fix and verify every open finding in the linked report. Do not re-audit unrelated sections.

## Already fixed in the parent pass
Fake phone removed, key send errors surfaced, payment history date/method.

## Open work
Searchable customer picker, MoneyInput/TextField, toasts, mobile tables, a11y labels, portal pay, timezone display.

## Exit criteria
All currency inputs use decimal keypad; no silent failures; axe/keyboard smoke passes.

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

