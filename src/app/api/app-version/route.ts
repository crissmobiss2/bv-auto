import { NextResponse } from "next/server";
import pkg from "../../../../package.json";

export async function GET() {
  return NextResponse.json({
    version: pkg.version,
    androidMinVersion: "0.1.0",
    iosMinVersion: "0.1.0",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.bvauto.app",
    appStoreUrl: "https://apps.apple.com/app/bv-auto/id0000000000",
    releaseNotes: "Bug fixes and performance improvements.",
    forceUpdate: false,
  });
}
