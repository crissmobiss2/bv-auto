import { apiSuccess } from "@/lib/api-helpers";

export async function GET() {
  return apiSuccess({ publicKey: process.env.VAPID_PUBLIC_KEY || "" });
}
