import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiSuccess, requireRole } from "@/lib/api-helpers";
import { rateLimit, getIP } from "@/lib/rate-limit";
import { z } from "zod";
import { emailConfigured, sendBookingConfirmationEmail } from "@/lib/email";
import { sendBookingConfirmationSMS, smsConfigured } from "@/lib/sms";
import { sendPushToUser } from "@/lib/push";
import { resolvePublicShop } from "@/lib/public-shop";
import { enterShop } from "@/lib/tenant";

const BOOKING_STAFF_ROLES = ["ADMIN", "DISPATCHER", "SERVICE_ADVISOR"] as const;

const bookingSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(7),
  email: z.string().email().optional().or(z.literal("")),
  vehicleYear: z.number().int().optional(),
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  serviceType: z.string().min(1),
  description: z.string().min(1),
  photoUrl: z.string().optional(),
  preferredDate: z.string().optional(),
  smsConsent: z.boolean().optional(),
  shop: z.string().max(80).optional(),
  website: z.string().max(200).optional(),
  elapsedMs: z.number().optional(),
});

export async function POST(req: NextRequest) {
  // Public endpoint — limit to 5 booking requests per 10 min per IP
  if (!(await rateLimit(`booking:${getIP(req)}`, 5, 10 * 60_000))) {
    return apiError("Too many requests. Please call the shop directly.", 429);
  }
  const body = await req.json();
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid data", 400);

  const data = parsed.data;

  // Spam bots fill the hidden "website" field or submit instantly; answer as if it worked so they don't adapt.
  if (data.website || (data.elapsedMs !== undefined && data.elapsedMs < 3000)) {
    return apiSuccess({ received: true }, 201);
  }

  // Bookings belong to the shop named in the link (?shop=slug); links without one go to the original shop.
  const shop = await resolvePublicShop(data.shop);
  if (!shop) return apiError("Shop not found", 404);
  enterShop(shop.id);

  // Try to find existing customer by phone
  const existing = await prisma.customer.findFirst({
    where: { phone: data.phone },
    select: { id: true },
  });

  const request = await prisma.serviceRequest.create({
    data: {
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      vehicleYear: data.vehicleYear ?? null,
      vehicleMake: data.vehicleMake || null,
      vehicleModel: data.vehicleModel || null,
      serviceType: data.serviceType,
      description: data.description,
      photoUrl: data.photoUrl || null,
      preferredDate: data.preferredDate || null,
      customerId: existing?.id ?? null,
      smsConsent: data.smsConsent === true,
      smsConsentAt: data.smsConsent ? new Date() : null,
    },
  });

  const reference = `BR-${request.id.slice(-6).toUpperCase()}`;
  const { customerNotified } = await notifyBooking(request, reference);

  return apiSuccess({ id: request.id, reference, customerNotified }, 201);
}

// Confirmation to the customer plus an in-app + push alert to staff. A provider
// failure must never lose the booking, so every send is best-effort.
async function notifyBooking(
  request: { id: string; name: string; phone: string; email: string | null; serviceType: string; preferredDate: string | null; smsConsent: boolean },
  reference: string,
) {
  let customerNotified = false;
  const firstName = request.name.split(" ")[0] || request.name;
  // Texts only go to people who ticked the consent box (TCPA / carrier A2P rules).
  if (smsConfigured && request.smsConsent) {
    try {
      await sendBookingConfirmationSMS({ to: request.phone, customerName: firstName, reference });
      customerNotified = true;
    } catch (e) {
      console.error("Booking confirmation SMS failed:", (e as Error).message);
    }
  }
  if (request.email && emailConfigured) {
    try {
      await sendBookingConfirmationEmail({ to: request.email, customerName: firstName, reference, serviceType: request.serviceType, preferredDate: request.preferredDate });
      customerNotified = true;
    } catch (e) {
      console.error("Booking confirmation email failed:", (e as Error).message);
    }
  }

  try {
    const title = "New booking request";
    const body = `${request.name} · ${request.serviceType}${request.preferredDate ? ` · ${request.preferredDate}` : ""}`;
    const staff = await prisma.user.findMany({
      where: { isActive: true, role: { in: [...BOOKING_STAFF_ROLES] } },
      select: { id: true },
    });
    if (staff.length > 0) {
      await prisma.notification.createMany({
        data: staff.map((u) => ({ userId: u.id, title, body, link: "/service-requests" })),
      });
      await Promise.allSettled(staff.map((u) => sendPushToUser(u.id, { title, body, url: "/service-requests", tag: `booking-${request.id}` })));
    }
  } catch (e) {
    console.error("Booking staff alert failed:", (e as Error).message);
  }
  return { customerNotified };
}

export async function GET(req: NextRequest) {
  // The booking form is public; the list of submitted requests is not.
  const { error } = await requireRole(["ADMIN", "DISPATCHER", "SERVICE_ADVISOR"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const requests = await prisma.serviceRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: { customer: { select: { id: true, firstName: true, lastName: true } } },
  });

  return apiSuccess(requests);
}
