# Fix Workspace - Platform & Infra

- **Status:** PARTIAL
- **Audit report:** ../11-platform-infra.md
- **Objective:** Fix and verify every open finding in the linked report. Do not re-audit unrelated sections.

## Already fixed in the parent pass
Service-worker API cache removed, Electron exact origin, cache clear on sign-out, headers/Sentry/CI exist.

## Open work
CI master trigger, migrations, release APK, CSP hardening, shared rate limits, Sentry/backup verification.

## Exit criteria
CI runs on master; deploy uses migrations; APK is release-signed; CSP has no unsafe-eval.

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

