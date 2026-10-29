# Status update - technician role boundary and customer financial redaction

- **AUTH-015 (warranty access):** the technician blocklist used `/api/warranty` while the API route is `/api/warranties`, so technicians could read and mutate warranty records. Both spellings are now blocked in `src/lib/role-access.ts`, and the warranty routes require `ADMIN`/`DISPATCHER` themselves.
- **AUTH-015 (customer and vehicle redaction):** customer list/detail responses returned invoice history, invoice counts, lifetime revenue, average ticket, and CLV to technicians, and vehicle detail returned each job's quote and invoice totals. Those fields are now limited to `ADMIN`, `DISPATCHER`, `ACCOUNTANT`, and `SERVICE_ADVISOR`; technicians and parts coordinators still receive contact, vehicle, and job data.
- **Tests:** `src/__tests__/role-access.test.ts` covers the warranty route spellings, the technician job/settings allowlist, customer financial roles, and the customer API allowlist.
- **Verification:** type-check, lint, 108/108 Vitest tests, and the 141-page production build pass.
