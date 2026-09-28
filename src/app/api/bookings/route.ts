import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { prefixedRef, generateUniqueBookingRef } from "@/lib/ref";
import { bookingSubmissionSchema } from "@/lib/validation";
import { sendBookingReceived, sendAdminNewBookingAlert } from "@/lib/email/emailService";

function isUniqueRefConflict(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002" &&
    Array.isArray((err.meta as { target?: unknown })?.target) &&
    (err.meta!.target as string[]).includes("ref")
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = bookingSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, email, phone, preferredDate, preferredTime, location, agentName, estate, plotCode, unitType, sqm, sqmNeeded, selectionType } = parsed.data;

  const preferredDateObj = new Date(preferredDate);
  if (Number.isNaN(preferredDateObj.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  // Preferred date should not be in the past (allow today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const prefDay = new Date(preferredDateObj);
  prefDay.setHours(0, 0, 0, 0);
  if (prefDay.getTime() < today.getTime()) {
    return NextResponse.json({ error: "Preferred date cannot be in the past" }, { status: 400 });
  }

  // generateUniqueBookingRef checks for a collision before insert, but that check
  // and the insert aren't atomic under concurrent submissions two requests
  // could both pass the check for the same ref. Retry on the DB's unique
  // constraint as the actual source of truth.
  // Duplicate check before insert
  let possibleDuplicateOfId: string | null = null;
  try {
    const dupWindow = await prisma.inspectionBooking.findFirst({
      where: {
        status: { not: "closed" },
        OR: [
          ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, preferredDate: true, rescheduledDate: true },
    });
    if (dupWindow) {
      const aDate = preferredDateObj.getTime();
      const bDate = (dupWindow.rescheduledDate ?? dupWindow.preferredDate).getTime();
      if (Math.abs(aDate - bDate) / (1000 * 60 * 60 * 24) <= 3) {
        possibleDuplicateOfId = dupWindow.id;
      }
    }
  } catch (e) {
    // Best-effort duplicate hint only — a lookup failure must not block booking.
    console.error("Booking duplicate-window lookup failed", e);
  }

  let ref = await generateUniqueBookingRef();
  const { findOrCreateCustomer } = await import("@/lib/customer");
  const { normalizeEmail, normalizeName, normalizePhoneE164 } = await import("@/lib/phone");
  const customerName = normalizeName(name) ?? name;
  const customerEmail = normalizeEmail(email) ?? email;
  const customerPhone = normalizePhoneE164(phone);
  const customer = await findOrCreateCustomer({ name: customerName, email: customerEmail, phone: customerPhone });
  let booking;
  for (let attempt = 0; ; attempt++) {
    try {
      booking = await prisma.inspectionBooking.create({
        data: {
          ref,
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          customerId: customer.id,
          preferredDate: preferredDateObj,
          preferredTime,
          location,
          agentName: agentName || null,
          visitorAgentRaw: agentName || null,
          possibleDuplicateOfId,
          status: "new",
          estate: estate || null,
          plotCode: plotCode || null,
          unitType: unitType || null,
          sqm: typeof sqm === "number" ? sqm : null,
          sqmNeeded: typeof sqmNeeded === "number" ? sqmNeeded : null,
          selectionType: selectionType || (sqmNeeded ? "sqm_needed" : plotCode ? "unit" : null),
        },
      });
      break;
    } catch (err) {
      if (isUniqueRefConflict(err) && attempt < 4) {
        ref = prefixedRef("BKG");
        continue;
      }
      throw err;
    }
  }

  // Visitor confirmation blocking, they need the reference code before we respond.
  await sendBookingReceived(booking.email, booking);

  // Admin/staff alert fire-and-forget, must not delay or fail the visitor's response.
  // Notifications are created even if email fails; email failure is logged only.
  prisma.user
    .findMany({ where: { role: { in: ["admin", "staff"] } }, select: { id: true, email: true } })
    .then(async (recipients) => {
      if (recipients.length === 0) return;
      const emailPromise = sendAdminNewBookingAlert(
        recipients.map((r) => r.email),
        booking
      )
        .then((r) => {
          if (!r.sent) console.error("Admin alert email failed:", r.error);
        })
        .catch((err) => console.error("Admin alert email threw:", err));
      const notifPromise = prisma.notification
        .createMany({
          data: recipients.map((r) => ({
            userId: r.id,
            type: "new_booking",
            message: `New inspection booking ${booking.ref} from ${booking.name}`,
            bookingId: booking.id,
          })),
        })
        .catch((err) => console.error("Notification create failed:", err));
      await Promise.allSettled([emailPromise, notifPromise]);
    })
    .catch((err) => console.error("Admin alert/notification lookup failed:", err));

  return NextResponse.json({ ref: booking.ref, id: booking.id }, { status: 201 });
}
