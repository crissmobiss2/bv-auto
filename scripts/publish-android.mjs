#!/usr/bin/env node
// Builds the signed release APK, refuses it unless it carries the expected signing
// certificate and a higher versionCode, then publishes it to public/app-release.apk
// and records its metadata in src/lib/android-release.json (served by /api/app-version).
//
// Usage: BVAUTO_KEYSTORE_FILE=... BVAUTO_KEYSTORE_PASSWORD=... BVAUTO_KEY_ALIAS=... \
//        BVAUTO_KEY_PASSWORD=... npm run android:publish [-- --skip-build --apk path.apk]
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const args = process.argv.slice(2);
const skipBuild = args.includes("--skip-build");
const apkArg = args.includes("--apk") ? args[args.indexOf("--apk") + 1] : null;
const releaseJsonPath = path.join(root, "src/lib/android-release.json");
const signing = JSON.parse(readFileSync(path.join(root, "android/release-signing.json"), "utf8"));
const previous = JSON.parse(readFileSync(releaseJsonPath, "utf8"));

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function buildTool(name) {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(homedir(), "Android/Sdk");
  const dir = path.join(sdk, "build-tools");
  if (!existsSync(dir)) fail(`Android build-tools not found under ${sdk}; set ANDROID_HOME`);
  const versions = readdirSync(dir).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  for (const v of versions) {
    const p = path.join(dir, v, name);
    if (existsSync(p)) return p;
  }
  fail(`${name} not found in ${dir}`);
}

if (!skipBuild) {
  if (!process.env.BVAUTO_KEYSTORE_FILE && !process.env.CM_KEYSTORE_PATH) {
    fail("Set BVAUTO_KEYSTORE_FILE, BVAUTO_KEYSTORE_PASSWORD, BVAUTO_KEY_ALIAS and BVAUTO_KEY_PASSWORD");
  }
  execFileSync("npx", ["cap", "sync", "android"], { cwd: root, stdio: "inherit" });
  execFileSync("./gradlew", ["assembleRelease"], { cwd: path.join(root, "android"), stdio: "inherit" });
}

const apk = apkArg
  ? path.resolve(apkArg)
  : path.join(root, "android/app/build/outputs/apk/release/app-release.apk");
if (!existsSync(apk)) fail(`No signed APK at ${apk} (an unsigned build is named app-release-unsigned.apk)`);

const certs = execFileSync(buildTool("apksigner"), ["verify", "--print-certs", apk], { encoding: "utf8" });
const signerDigests = [...certs.matchAll(/certificate SHA-256 digest: ([0-9a-f]{64})/g)].map((d) => d[1]);
if (signerDigests.length === 0) fail("apksigner could not read a signing certificate");
if (signerDigests.length > 1) fail(`APK has ${signerDigests.length} signers; installed apps expect exactly one`);
const [signerCertSha256] = signerDigests;
if (signerCertSha256 !== signing.expectedSignerCertSha256) {
  fail(
    `APK is signed with ${signerCertSha256}, expected ${signing.expectedSignerCertSha256}.\n` +
      "  Installed apps would refuse this update (\"App not installed\"). Use the release keystore.",
  );
}

const badging = execFileSync(buildTool("aapt"), ["dump", "badging", apk], { encoding: "utf8" });
const m = /package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/.exec(badging);
if (!m || m[1] !== "com.bvauto.app") fail("APK is not com.bvauto.app");
const versionCode = Number(m[2]);
const versionName = m[3];
if (versionCode <= previous.versionCode) {
  fail(`versionCode ${versionCode} must be greater than the published ${previous.versionCode}; bump android/app/build.gradle`);
}

const apkSha256 = createHash("sha256").update(readFileSync(apk)).digest("hex");
copyFileSync(apk, path.join(root, "public/app-release.apk"));
const release = { ...previous, versionCode, versionName, apkSha256, signerCertSha256 };
writeFileSync(releaseJsonPath, JSON.stringify(release, null, 2) + "\n");
console.log(`\n✔ Published com.bvauto.app ${versionName} (${versionCode}) → public/app-release.apk`);
console.log("  Commit public/app-release.apk and src/lib/android-release.json, then push to deploy.");
