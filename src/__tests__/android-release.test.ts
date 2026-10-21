import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import release from "@/lib/android-release.json";
import { GET } from "@/app/api/app-version/route";

const root = path.resolve(__dirname, "../..");

describe("published Android release", () => {
  it("is not ahead of android/app/build.gradle", () => {
    const gradle = readFileSync(path.join(root, "android/app/build.gradle"), "utf8");
    expect(Number(/versionCode (\d+)/.exec(gradle)?.[1])).toBeGreaterThanOrEqual(release.versionCode);
  });

  it("describes the APK in public/", () => {
    const apk = readFileSync(path.join(root, "public/app-release.apk"));
    expect(createHash("sha256").update(apk).digest("hex")).toBe(release.apkSha256);
  });

  it("is served by /api/app-version with a cache-busting download URL", async () => {
    const res = await GET(new NextRequest("https://bv-auto.vercel.app/api/app-version"));
    const body = await res.json();
    expect(body.androidVersionCode).toBe(release.versionCode);
    expect(body.androidVersionName).toBe(release.versionName);
    expect(body.downloadUrl).toBe(`https://bv-auto.vercel.app/app-release.apk?v=${release.versionCode}`);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
