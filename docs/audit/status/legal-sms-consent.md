# Launch readiness: public legal pages, SMS consent, email sender

- Public `/privacy` and `/terms` pages (allowlisted in `src/proxy.ts`), linked from the login page and the booking form. They use the active shop's name, phone and email. Text is a starting draft, not legal advice: have it reviewed.
- Booking form has an optional SMS consent checkbox with carrier-required disclosures (frequency, rates, STOP/HELP, not a condition of purchase). `ServiceRequest.smsConsent` / `smsConsentAt` record it; the booking confirmation text is only sent when consent was given.
- New-customer dialog has a "customer agreed to receive texts" box stored as `Customer.smsConsentAt`.
- `src/lib/email.ts` sender now honors `RESEND_FROM_EMAIL` (previously ignored).
- Migration `20261026000000_sms_consent` (idempotent; already applied to production).

Verified locally: type-check, lint, tests (`booking-consent.test.ts`), build. Not tested in a browser or against live Twilio/Resend.
