# Status update — payroll period lock (branch `devin/*-payroll-lock`)

- **FIN-006 (fixed)**: new `PayrollRun` table. `POST /api/payroll/runs` (ADMIN/ACCOUNTANT) approves a finished period: it refuses periods ending today or later, periods with open time logs, and periods overlapping another approved run, then freezes every line in `snapshot`. `GET /api/payroll` serves an approved period from the snapshot, so later rate, time-log or invoice edits no longer change it. `DELETE /api/payroll/runs?id=` (ADMIN) reopens a period and is audit-logged. The payroll page shows an Approved/Estimate banner with Approve and Reopen buttons; CSV exports are labelled APPROVED or ESTIMATE.
- **Payout integrity**: `POST /api/payroll/payouts` for an approved period records the snapshot hours and amount, not the values sent by the browser.
- **FIN-010 (fixed)**: payroll includes active users with the TECHNICIAN/ADMIN role, a pay profile, or time logs in the period, so owners with any role are not dropped.
- **FIN-011 (partly fixed)**: hourly pay over 40 hours per Monday-start workweek is paid at 1.5x and shown as Overtime Hours. Commission is paid once per job even with several clock-ins. Burden and reimbursements are still open.
- Tests: `src/__tests__/payroll.test.ts` (overtime, week boundaries, commission once per job, open logs ignored).
