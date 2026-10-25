# Fix Workspaces

Each file in this folder is a dedicated fix-only workspace for one audit section. The matching audit report is the source of truth for findings; these workspaces track what was already fixed in the parent pass and what remains.

| Lane | Status | Audit report | Focus |
|---|---|---|---|
| `01-auth-security.md` | PARTIAL | `../01-auth-security.md` | Tenant scoping, rate limits, session revocation |
| `02-crm-vehicles.md` | PARTIAL | `../02-crm-vehicles.md` | Search/merge/VIN, shop scoping |
| `03-jobs-dispatch-tech.md` | PARTIAL | `../03-jobs-dispatch-tech.md` | State machine, numbers, subroute audit |
| `04-billing-payments.md` | PARTIAL | `../04-billing-payments.md` | Refunds, deposits, Stripe expiry |
| `05-customer-portal-public.md` | PARTIAL | `../05-customer-portal-public.md` | Token lifecycle, tracking token, portal pay |
| `06-parts-inventory.md` | PARTIAL | `../06-parts-inventory.md` | Receiving, ledger, vendor/PO validation |
| `07-communications-growth.md` | PARTIAL | `../07-communications-growth.md` | Consent, delivery status, paid-send limits |
| `08-reports-payroll-accounting.md` | PARTIAL | `../08-reports-payroll-accounting.md` | CSV safety, period lock, revenue source |
| `09-ai-diagnostics-data.md` | PARTIAL | `../09-ai-diagnostics-data.md` | Model envs, schema, PII, cost |
| `10-database-data-integrity.md` | OPEN | `../10-database-data-integrity.md` | Tenant fields, migrations, ledger |
| `11-platform-infra.md` | PARTIAL | `../11-platform-infra.md` | CI branch, migrations, APK, CSP |
| `12-ux-accessibility.md` | PARTIAL | `../12-ux-accessibility.md` | Inputs, toasts, tables, a11y |
| `13-quality-testing.md` | OPEN | `../13-quality-testing.md` | Authz/E2E/money tests |
| `14-workflow-e2e.md` | PARTIAL | `../14-workflow-e2e.md` | Booking, deposits, refunds, cancellation |

## Why these were not run as child agents
The configured OpenRouter key is exhausted (`$10.00 of $10.00 used; does not reset`), so subagent workspaces could not be launched. The parent session performed the Phase 0 fixes directly and created these lanes so each remaining section can be handed to a separate fix session without re-auditing.

## Lane protocol
1. Read the linked audit report and this lane file.
2. Fix only open findings in that section.
3. Add tests for money/authz/ownership changes.
4. Run the verification block in the lane file.
5. Update the lane file with files changed, commands, and remaining blockers.
6. Do not mark a provider-dependent fix “verified” without the real key; use `Unverified — needs runtime`.
