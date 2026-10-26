# Review follow-ups for merged PRs #56, #58, #59, #61

Devin Review findings that arrived after these PRs merged, fixed here:

- #56: clock-out no longer reopens or rewrites a time log already closed by job cancellation.
- #56: vehicle edit accepts VINs with spaces/dashes (normalized before validation); clearing the VIN saves null.
- #56: deleted job photo URLs are no longer kept in the audit record.
- #59: `AUDIT_RETENTION_DAYS=0` (or any low value) now clamps to the 30-day minimum instead of 365.
- #59: audit redaction walks up to 20 levels and replaces anything deeper with `[truncated]`.
- #58: date-only follow-up due dates are stored as shop-local midnight, so they display on the chosen day.
- #58: display timezone falls back to `SHOP_TIMEZONE` (exposed to the client via next.config `env`).
- #58: customer search matches full names ("Jane Doe") across first/last/company.
- #61: the portal error screen's "Go home" returns to the guest's tokenized portal page.

Dismissed: #59 "audit notes bypass redaction" — the only caller passing notes uses a fixed string ("CCPA data export").

Verified locally: type-check, lint, 58 tests, build. Not verified in a browser or against production data.
Existing follow-ups saved before this change keep their UTC-midnight timestamps (may still show one day early).
