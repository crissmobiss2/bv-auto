/**
 * Icon generation script — run once before building for stores.
 *
 * Prerequisites:
 *   npm install --save-dev sharp png-to-ico
 *   On macOS, also: brew install png2icns
 *
 * Usage:
 *   node scripts/generate-icons.mjs
 */

import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// Sizes needed by electron-builder, Capacitor Android, and Capacitor iOS
const ELECTRON_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];
const ANDROID_SIZES = [
  { size: 48,  dir: "mipmap-mdpi"    },
  { size: 72,  dir: "mipmap-hdpi"    },
  { size: 96,  dir: "mipmap-xhdpi"   },
  { size: 144, dir: "mipmap-xxhdpi"  },
  { size: 192, dir: "mipmap-xxxhdpi" },
  { size: 512, dir: "playstore"      },
];
const IOS_SIZES = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024];

const SOURCE_SVG = path.join(ROOT, "public/icons/icon.svg");
const svgBuffer = fs.readFileSync(SOURCE_SVG);

async function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function generatePng(size, dest) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(dest);
  console.log(`  ✓ ${dest}`);
}

async function main() {
  console.log("Generating icons from", SOURCE_SVG, "\n");

  // ── Electron / Desktop ──────────────────────────────────────────────────────
  console.log("── Electron (build/) ──");
  await ensureDir(path.join(ROOT, "build"));
  for (const size of ELECTRON_SIZES) {
    await generatePng(size, path.join(ROOT, "build", `icon-${size}.png`));
  }
  // 512px PNG is the primary icon for Linux
  await generatePng(512, path.join(ROOT, "build", "icon.png"));
  await generatePng(16,  path.join(ROOT, "build", "tray.png"));

  // ICO for Windows (requires png-to-ico)
  try {
    const { default: pngToIco } = await import("png-to-ico");
    const icoBuffer = await pngToIco([
      path.join(ROOT, "build", "icon-16.png"),
      path.join(ROOT, "build", "icon-32.png"),
      path.join(ROOT, "build", "icon-48.png"),
      path.join(ROOT, "build", "icon-256.png"),
    ]);
    fs.writeFileSync(path.join(ROOT, "build", "icon.ico"), icoBuffer);
    console.log("  ✓ build/icon.ico");
  } catch {
    console.warn("  ⚠ png-to-ico not installed — skipping .ico (needed for Windows)");
    console.warn("    Run: npm install --save-dev png-to-ico");
  }

  // ICNS for macOS (requires png2icns CLI or iconutil)
  console.log("  ℹ  For macOS .icns: run  npm run icons:icns  on a Mac");

  // ── Capacitor / Android ─────────────────────────────────────────────────────
  console.log("\n── Android (resources/android/) ──");
  for (const { size, dir } of ANDROID_SIZES) {
    const dest = path.join(ROOT, "resources/android", dir);
    await ensureDir(dest);
    await generatePng(size, path.join(dest, "ic_launcher.png"));
    await generatePng(size, path.join(dest, "ic_launcher_round.png"));
  }

  // ── Capacitor / iOS ─────────────────────────────────────────────────────────
  console.log("\n── iOS (resources/ios/AppIcon.appiconset/) ──");
  const iosDir = path.join(ROOT, "resources/ios/AppIcon.appiconset");
  await ensureDir(iosDir);
  for (const size of IOS_SIZES) {
    await generatePng(size, path.join(iosDir, `Icon-${size}.png`));
  }

  // Contents.json for Xcode
  const contentsJson = {
    images: [
      { filename: "Icon-20.png",   idiom: "iphone", scale: "1x", size: "20x20" },
      { filename: "Icon-40.png",   idiom: "iphone", scale: "2x", size: "20x20" },
      { filename: "Icon-60.png",   idiom: "iphone", scale: "3x", size: "20x20" },
      { filename: "Icon-29.png",   idiom: "iphone", scale: "1x", size: "29x29" },
      { filename: "Icon-58.png",   idiom: "iphone", scale: "2x", size: "29x29" },
      { filename: "Icon-87.png",   idiom: "iphone", scale: "3x", size: "29x29" },
      { filename: "Icon-40.png",   idiom: "iphone", scale: "1x", size: "40x40" },
      { filename: "Icon-80.png",   idiom: "iphone", scale: "2x", size: "40x40" },
      { filename: "Icon-120.png",  idiom: "iphone", scale: "3x", size: "40x40" },
      { filename: "Icon-60.png",   idiom: "iphone", scale: "1x", size: "60x60" },
      { filename: "Icon-120.png",  idiom: "iphone", scale: "2x", size: "60x60" },
      { filename: "Icon-180.png",  idiom: "iphone", scale: "3x", size: "60x60" },
      { filename: "Icon-76.png",   idiom: "ipad",   scale: "1x", size: "76x76" },
      { filename: "Icon-152.png",  idiom: "ipad",   scale: "2x", size: "76x76" },
      { filename: "Icon-167.png",  idiom: "ipad",   scale: "2x", size: "83.5x83.5" },
      { filename: "Icon-1024.png", idiom: "ios-marketing", scale: "1x", size: "1024x1024" },
    ],
    info: { author: "xcode", version: 1 },
  };
  fs.writeFileSync(
    path.join(iosDir, "Contents.json"),
    JSON.stringify(contentsJson, null, 2),
  );
  console.log("  ✓ Contents.json");

  // ── PWA icons ───────────────────────────────────────────────────────────────
  console.log("\n── PWA (public/icons/) ──");
  await ensureDir(path.join(ROOT, "public/icons"));
  await generatePng(192, path.join(ROOT, "public/icons", "icon-192.png"));
  await generatePng(512, path.join(ROOT, "public/icons", "icon-512.png"));
  await generatePng(180, path.join(ROOT, "public/icons", "apple-touch-icon.png"));
  await generatePng(32,  path.join(ROOT, "public/icons", "favicon-32x32.png"));

  console.log("\n✅ All icons generated successfully.");
  console.log("\nNext steps:");
  console.log("  • Windows:  build/icon.ico is ready");
  console.log("  • macOS:    run  iconutil -c icns build/icon.iconset  on a Mac to create icon.icns");
  console.log("  • Android:  run  npx cap sync android  then open in Android Studio");
  console.log("  • iOS:      run  npx cap sync ios  then open in Xcode");
}

main().catch(console.error);
