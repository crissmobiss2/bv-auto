import { NextRequest, NextResponse } from "next/server";
import pkg from "../../../../package.json";
import androidRelease from "@/lib/android-release.json";

export async function GET(req: NextRequest) {
  const downloadUrl = new URL("/app-release.apk", req.nextUrl.origin);
  downloadUrl.searchParams.set("v", String(androidRelease.versionCode));
  return NextResponse.json(
    {
      version: pkg.version,
      androidVersionCode: androidRelease.versionCode,
      androidVersionName: androidRelease.versionName,
      androidApkSha256: androidRelease.apkSha256,
      androidRequiresReinstallBelow: androidRelease.requiresReinstallBelow,
      androidMinVersion: "0.1.0",
      iosMinVersion: "0.1.0",
      downloadUrl: downloadUrl.toString(),
      playStoreUrl: "https://play.google.com/store/apps/details?id=com.bvauto.app",
      appStoreUrl: "https://apps.apple.com/app/bv-auto/id0000000000",
      releaseNotes: "Security update for the app's phone layer (Capacitor 8.5.3).",
      forceUpdate: false,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
