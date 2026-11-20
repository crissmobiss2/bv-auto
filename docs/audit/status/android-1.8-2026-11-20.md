# Android 1.8 (build 9) — 2026-11-20

## Release

| Field | Value |
| --- | --- |
| Package | `com.bvauto.app` |
| Version | `1.8` (`versionCode 9`) |
| APK | `public/app-release.apk` |
| Size | 3,285,878 bytes |
| SHA-256 | `bbe53ac31295a8ec6dd7b9fdfaba47de975c6b4dc793ec6ed932fe745c1d7989` |
| Signer | `CN=BV Auto, OU=Mobile, O=BV Auto, C=US` |
| Certificate SHA-256 | `8e313beb1627c9a4f407e6159adc33d54fcf4061f9f5aaa71e982cee3c7cf34e` |
| Server URL | `https://bv-auto.vercel.app` |
| Native keyboard | `captureInput: false` |

`apksigner verify` passes with one signer. The app loads the live site, so this
release includes every web fix deployed up to 2026-11-20.

## Included fixes

- Technician DVI action bar no longer sits under the bottom navigation.
- Quote “Send” mints and copies an approval link even without email/SMS.
- Admin password reset in Settings → Team Members.
- Portal message validation hardening.
- Next.js 16.4.6, Prisma 7.10.1, Electron 44.11.5, Vite 8.3.8, Vitest 5.1.1.
- Production timezone corrected to `America/Chicago`.
- Codemagic signing variables and verified CI signing.

## Install / update

- Installed **1.7 (build 8)** or newer: the in-app updater offers 1.8 and installs
  in place (same signing key).
- Installed **1.6 (build 7) or older**: the in-app updater shows the one-time
  uninstall/reinstall instruction because the signing key changed in 1.7.
- Direct download: `https://bv-auto.vercel.app/app-release.apk?v=9`

## CI

`android-signing-verify` build `6aff9abd8f52ca2751291ec9` passed all steps and
produced an APK with the same certificate. The release keystore is stored in the
restricted `android_release_signing` Codemagic variable group; future
`android-apk-update` runs only need a version bump.
