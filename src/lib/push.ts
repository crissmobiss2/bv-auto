import webpush from "web-push";
import { prisma } from "@/lib/prisma";

// VAPID keys — set in env vars
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:service@bvauto.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

export async function sendPushToUser(userId: string, notification: {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
}) {
  const tokens = await prisma.pushToken.findMany({ where: { userId } });
  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    icon: notification.icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    url: notification.url || "/",
    tag: notification.tag,
  });

  const results = await Promise.allSettled(
    tokens.map(async (t) => {
      if (t.platform === "web") {
        const sub = JSON.parse(t.token) as webpush.PushSubscription;
        return webpush.sendNotification(sub, payload);
      }
      // For Capacitor native, we'd use FCM — log for now
      console.log("[push] Native push for token:", t.token.slice(0, 20));
    })
  );

  // Remove expired/invalid tokens
  const failed = results.map((r, i) => ({ r, token: tokens[i] }))
    .filter(({ r }) => r.status === "rejected");
  for (const { token } of failed) {
    await prisma.pushToken.delete({ where: { id: token.id } }).catch(() => {});
  }

  return results;
}

export async function sendPushToRole(role: string, notification: Parameters<typeof sendPushToUser>[1]) {
  const users = await prisma.user.findMany({ where: { role: role as never, isActive: true }, select: { id: true } });
  return Promise.all(users.map(u => sendPushToUser(u.id, notification)));
}
