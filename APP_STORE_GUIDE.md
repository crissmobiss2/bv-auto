# B&V Auto — App Store Publishing Guide

## Overview
The app is distributed as:
| Platform       | Format     | Tool         |
|----------------|------------|--------------|
| Google Play    | AAB/APK    | Capacitor    |
| Apple App Store| IPA        | Capacitor    |
| Windows        | .exe       | Electron     |
| macOS          | .dmg       | Electron     |
| Linux          | .AppImage  | Electron     |

---

## Step 0 — Generate Icons (do once)

```bash
npm install --save-dev sharp png-to-ico
node scripts/generate-icons.mjs
```

This creates:
- `build/icon.ico` — Windows
- `build/icon.png` — Linux / Electron
- `resources/android/mipmap-*/` — Android
- `resources/ios/AppIcon.appiconset/` — iOS
- `public/icons/icon-192.png`, `icon-512.png` — PWA

For macOS `.icns`, run on a Mac:
```bash
mkdir -p build/icon.iconset
sips -z 512 512 build/icon.png --out build/icon.iconset/icon_512x512.png
iconutil -c icns build/icon.iconset -o build/icon.icns
```

---

## Google Play Store (Android)

### Requirements
- Google Play Developer account: https://play.google.com/console ($25 one-time)
- Android Studio installed on your machine
- Java 17+ installed

### Steps
```bash
# 1. Add Android platform (first time only)
npx cap add android

# 2. Copy icons and sync assets
npm run icons
npx cap sync android

# 3. Open in Android Studio
npx cap open android
```

In Android Studio:
1. **Build → Generate Signed Bundle/APK**
2. Choose **Android App Bundle (AAB)** (required for Play Store)
3. Create or use existing keystore — **save the keystore file and passwords somewhere safe**
4. Build the release AAB

Upload to Google Play Console:
- Create new app → fill in details
- Upload the `.aab` file to Internal testing track first
- Promote to Production after testing

### App details needed
- App name: `B&V Auto`
- Short description: Mobile auto repair business management
- Category: Business
- Content rating: Everyone
- Privacy policy URL: your domain + `/privacy`

---

## Apple App Store (iOS)

### Requirements
- Apple Developer account: https://developer.apple.com ($99/year)
- Mac with Xcode 16+ installed
- iPhone/iPad for testing

### Steps
```bash
# 1. Add iOS platform (first time only, run on Mac)
npx cap add ios

# 2. Copy icons and sync
npm run icons
npx cap sync ios

# 3. Open in Xcode
npx cap open ios
```

In Xcode:
1. Select your Team in Signing & Capabilities
2. Set Bundle Identifier: `com.bvauto.app`
3. **Product → Archive**
4. In Organizer, click **Distribute App → App Store Connect**

In App Store Connect (appstoreconnect.apple.com):
- Create new app with bundle ID `com.bvauto.app`
- Upload screenshots (6.7" iPhone required)
- Fill in metadata, submit for review

---

## Windows Desktop (.exe)

### Requirements
- Node.js 18+ on Windows (or any OS for cross-compile)
- Optional: Windows code signing certificate for trusted installer

### Steps
```bash
# Install electron + electron-builder
npm install

# Generate icons (needs sharp)
node scripts/generate-icons.mjs

# Build Windows installer
npm run desktop:build:win
```

Output: `dist/B&V Auto Setup x.x.x.exe` (NSIS installer)
Also: `dist/B&V Auto x.x.x.exe` (portable, no install needed)

Distribute the `.exe` via your website download page.

### Code signing (optional but recommended)
Without signing, Windows Defender SmartScreen will show a warning. To sign:
1. Purchase an EV code signing certificate (~$200/year)
2. Add to `electron-builder.yml`:
   ```yaml
   win:
     certificateFile: path/to/cert.p12
     certificatePassword: ${env.CSC_KEY_PASSWORD}
   ```

---

## macOS Desktop (.dmg)

### Requirements
- Mac with Xcode command line tools
- Apple Developer account for notarization (optional but recommended)

```bash
npm run desktop:build:mac
```

Output: `dist/B&V Auto-x.x.x.dmg`

---

## Linux (.AppImage)

```bash
npm run desktop:build:linux
```

Output: `dist/B&V Auto-x.x.x.AppImage`

---

## Quick test (Electron, no build)

```bash
npm install
npx electron .
```

This opens the desktop app loading your live Vercel deployment.

---

## App ID / Bundle Info

| Field       | Value              |
|-------------|--------------------|
| App ID      | `com.bvauto.app`   |
| App Name    | `B&V Auto`         |
| Version     | `0.1.0`            |
| Live URL    | `https://bv-auto.vercel.app` |
