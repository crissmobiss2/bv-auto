import { NextRequest, NextResponse } from "next/server";
import pkg from "../../../../package.json";

export async function GET(req: NextRequest) {
  return NextResponse.json({
    version: pkg.version,
    androidVersionCode: 4,
    androidVersionName: "1.3",
    androidMinVersion: "0.1.0",
    iosMinVersion: "0.1.0",
    downloadUrl: new URL("/app-release.apk", req.nextUrl.origin).toString(),
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.bvauto.app",
    appStoreUrl: "https://apps.apple.com/app/bv-auto/id0000000000",
    releaseNotes: "New: parts catalog search & purchase orders, invoice payment history on PDF, send/delivery feedback, customer editing, faster data entry.",
    forceUpdate: false,
  });
}
