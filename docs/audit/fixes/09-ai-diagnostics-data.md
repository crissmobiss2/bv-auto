# Fix Workspace - AI & Diagnostics

- **Status:** PARTIAL
- **Audit report:** ../09-ai-diagnostics-data.md
- **Objective:** Fix and verify every open finding in the linked report. Do not re-audit unrelated sections.

## Already fixed in the parent pass
AI estimate numeric coercion/recompute, diagnosis job ownership, missing-key 503.

## Open work
Model envs, JSON schema, prompt delimiting, PII redaction, cost quota, safe errors, structured diagnosis.

## Exit criteria
Model IDs are env-configured and tested; output is schema-valid; PII is minimized.

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

