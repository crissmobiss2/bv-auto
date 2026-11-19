# Customer feedback fixes (2026-11-19)

## Fixed

- **Autocorrect / capitalization**: shared `Input` and `Textarea` now default free-text fields to the phone keyboard's autocorrect, sentence capitalization, and spell check. Names, addresses, and company use `autoCapitalize="words"`. Structured fields (email, VIN, plate, state, phone) keep autocorrect/spell check off. Android's `captureInput` was set to `false`; the previous "simpler keyboard" input connection was blocking autocorrect. The native change takes effect in Android 1.7+.
- **Technician picker**: `/api/users?assignable=1` now returns active technicians **and** admins/owners. New Job, Schedule, Dispatch, and Shop Board use it. Brandon V. and Marcus Tech both appear.
- **Sales tax**: tax is calculated on `PART` lines only. Labor, fluids, shop supplies, and fees are not taxed. The rate defaults to the shop's 10.5% setting; the quote builder no longer asks for a manual rate. Quote save, quote conversion, and the invoice printout all re-apply the parts-only rule.
- **Customer last name**: optional in the customer form, onboarding, create API, and update API. Display helpers avoid trailing spaces when it is blank.
- **Invoice mileage**: invoice detail and the PDF show the job's mileage-out, mileage-in, or vehicle mileage.
- **Invoice branding**: customer-facing PDFs/texts/emails use **B&V Mobile Mechanic**. Legacy `B&V Mobile Auto` / migration placeholder `My Shop` names are mapped at read time, and a migration updates the default shop row.
- **Print / Save PDF**: `/api/invoices/[id]/pdf` now returns a real `application/pdf` rendered with `@react-pdf/renderer`, not an HTML page. The PDF button opens a short-lived HMAC-tokenized URL in the system browser (Capacitor `Browser`), so it works outside the app's session cookie. The proxy allows only `/api/invoices/*/pdf?token=...` without a session; the route verifies the token.
- **In-app Android updates**: version bumped to `versionCode 8` / `1.7`. Added the Codemagic `android-apk-update` workflow, which builds a release-signed APK with the existing `bvauto_keystore`, publishes `public/app-release.apk` + `src/lib/android-release.json`, and pushes them to `master` when `GITHUB_TOKEN` is available. Existing 1.6 (build 7) installs can update in place because the signing certificate is unchanged.

## Verification

- `npm run type-check`: pass
- `npm run lint`: pass
- `npx vitest run`: 119 tests / 28 files pass
- `npm run build`: 141 pages, pass
- Local production E2E:
  - New customer with first name + phone only: `lastName: ""`
  - New Job technician list: Brandon V. + Marcus Tech
  - Quote with $100 labor + $50 part at 10.5%: tax `$5.25`, total `$155.25`
  - Invoice conversion kept parts-only tax and non-taxable labor
  - Invoice page/PDF: `Mileage 12,350 mi`, `Sales tax (parts only, 10.5%)`, `B&V Mobile Mechanic`
  - Tokenized PDF fetched without cookies: `200 application/pdf`, valid `%PDF-` header
  - Rendered input attributes: `autocapitalize`, `autocorrect="on"`, `spellcheck="true"` on text fields

## Remaining deployment step

The release keystore is not available in this checkout. To publish Android 1.7 and activate the in-app update for installed 1.6 users, run the Codemagic **Android In-App Update APK** workflow (or push the `android-v1.7` tag). Without that signed APK, the web fixes still deploy through the Capacitor webview, but the native keyboard fix and in-app APK update cannot be delivered.
