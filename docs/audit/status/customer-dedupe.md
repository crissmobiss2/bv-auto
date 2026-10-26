# Status update — customer duplicates (branch `devin/*-customer-dedupe`)

- **CRM-008 (fixed)**: `POST /api/customers` returns 409 with `duplicates` when an active customer has the same last 10 phone digits or the same email (case-insensitive). The new-customer dialog lists the matches with links and offers "Create anyway" (`allowDuplicate: true`). Admins see a "Possible duplicates" card on the customer page. "Merge into this customer" (`POST /api/customers/[id]/merge`, ADMIN only, one transaction) does the following:
  - Moves vehicles, jobs, quotes, invoices, notes, communications, follow-ups, service requests, SMS, review requests, declined services, warranties, sequence enrollments and portal users.
  - Fills the surviving customer's blank fields, unions tags and keeps any SMS/marketing opt-out.
  - Deactivates the duplicate, clearing its portal token, and writes an audit entry.

  Merging two customers that don't share a phone or email still needs a manual picker (open).
