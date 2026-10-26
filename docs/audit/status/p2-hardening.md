# Status update — validation and hardening (branch `devin/*-p2-hardening`)

- **JOBS-005 (fixed)**: `src/lib/job-status.ts` defines the allowed status moves. `PATCH /api/jobs/[id]` returns 409 for anything else. Technicians are limited to scheduled, in progress, parts waiting and completed. Reopening a completed or cancelled job needs an admin or dispatcher; reopening an invoiced job needs an admin. A job can only be set to PAID once its invoice is PAID. Cancelling a job clocks out any running time logs.
- **JOBS-010 / DATA-005 (fixed)**: job, quote, invoice and PO creates retry with a fresh number when the unique key collides (`withUniqueRetry`), so a collision no longer fails the request. Numbers stay random rather than sequential.
- **JOBS-012 (fixed)**: notes, photo uploads/deletes, signatures and clock-in/out now write audit-log entries.
- **CRM-011 (fixed, validation only)**: VINs are trimmed and uppercased. A VIN must be 17 characters (model year 1981 or later) and can't contain I, O or Q. `vinCheckDigitValid` exists but is not enforced, because non-North-American VINs can fail it.
- **PART-006 (fixed)**: only an admin can set a sell price below cost, on create or edit.
- **AI-003 / AI-004 / AI-008 (fixed)**: models come from `ANTHROPIC_MODEL_DIAGNOSE`, `ANTHROPIC_MODEL_ESTIMATE` and `ANTHROPIC_MODEL_MESSAGE`, with the current models as defaults. Unparseable model output returns a 502 instead of crashing. Provider errors are logged server-side, and the client gets a generic message with a reference id.
- **AI-005 / AI-006 (partial)**: user-typed text is fenced in `<data>` blocks that it can't close, and the model is told not to follow instructions inside them. Emails and phone numbers are redacted, and only the customer's first name is sent. This reduces prompt-injection risk but does not prevent it.
- **AI-007 (open)**: there is still no per-shop AI cost quota; only the per-IP rate limits apply.
- **PLAT-005 (partial)**: `unsafe-eval` is dropped from the production CSP; the dev server still needs it. `unsafe-inline` remains until nonce-based CSP is wired up.
- **PLAT-012 (fixed)**: the service worker is registered as `/sw.js?v=<build id>`, and its cache name comes from that id, so each deploy clears the old caches.
- **QUAL-008 (fixed)**: `vitest.config.ts` was renamed to `vitest.config.mts`.
- **BILL-014 (fixed)**: the invoice print page no longer prints automatically. It shows a "Print / Save as PDF" button, and its title (the default PDF filename) is `invoice-<number>`.
