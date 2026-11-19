# Dependency / security upgrade (2026-11-19)

## Upgraded

| Package | From | To | Reason |
| --- | --- | --- | --- |
| `next` / `eslint-config-next` | 16.4.3 | 16.4.6 | Fixes the build-blocking security advisory plus two cache-disclosure advisories |
| `@prisma/client` / `prisma` | 7.8.0 / 7.10.0 | 7.10.1 | Fixes high-severity `deepmerge-ts` stack exhaustion |
| `electron` | 44.5.1 | 44.11.5 | Fixes high-severity Electron advisory |
| `vite` | 8.3.1 | 8.3.8 | Fixes high-severity Vite/launch-editor advisories |
| `vitest` | 5.0.2 | 5.1.1 | Fixes Vitest manual-mock code injection |
| `electron-builder` | 26.15.3 | 26.18.0 | Keeps desktop packaging on the current line |

`npm audit` went from **29 vulnerabilities (5 high)** to **6 moderate**. The
remaining six are all inside `electron-builder` → `app-builder-lib` →
`@electron/universal`/`minimatch` and only affect desktop packaging, not the
web or Android runtime. A forced fix would downgrade `electron-builder` to
25.1.0, so it was not applied.

## Verification

- `npm run type-check` PASS
- `npm run lint` PASS
- `npx vitest run` PASS — 28 files / 119 tests
- `npm run build` PASS on the first attempt, with no `SecurityFatalError`
- All 33 dashboard pages load in production mode; customer, technician, and
  unauthenticated flows still work
- Customer → vehicle → job → quote creation still works; parts-only tax remains
  `$7.35` on `$100 labor + $70 parts`; invoice PDF still renders `%PDF-`

## Related fixes in this batch

- Admin **Reset password** action in Settings → Team Members issues a one-time
  temporary password, signs out the member's old sessions, and is audited. This
  restores account recovery even when outbound email is not configured.
- Portal message API now rejects non-string bodies with `400` instead of `500`.
- Production `SHOP_TIMEZONE` and `NEXT_PUBLIC_SHOP_TIMEZONE` set to
  `America/Chicago` (the shop is in Houston, TX; the old default was Los Angeles).
- Codemagic Android workflows now read the release key from a restricted
  `android_release_signing` variable group (`BVAUTO_KEYSTORE_BASE64`,
  `BVAUTO_KEYSTORE_PASSWORD`, `BVAUTO_KEY_ALIAS`, `BVAUTO_KEY_PASSWORD`) instead
  of the missing `bvauto_keystore` code-signing identity. A non-publishing
  `android-signing-verify` workflow was added to test it.
