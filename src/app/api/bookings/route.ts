import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { prefixedRef, generateUniqueBookingRef } from "@/lib/ref";
import { bookingSubmissionSchema } from "@/lib/validation";
import { BELGROVE_PLOTS } from "@/lib/belgroveData";

// Direct Resend sends run in-request (bounded); allow headroom for DB work
// plus sends (Hobby max: 300s).
export const maxDuration = 60;

function isUniqueRefConflict(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002" &&
    Array.isArray((err.meta as { target?: unknown })?.target) &&
    (err.meta!.target as string[]).includes("ref")
  );
}

export async function POST(request: NextRequest) {
  // Public form: fixed-window limit per IP (spam friction, not a hard gate).
  const { checkRateLimit, clientIp, rateLimitResponse } = await import("@/lib/rate-limit");
  const rl = checkRateLimit(`booking:${clientIp(request.headers)}`, 20, 15 * 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);

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

  // Rule: no booking for a sold-out property. Enforced here — the form also
  // hides sold plots, but the API is the actual gate.
  if (plotCode) {
    const plot = BELGROVE_PLOTS.find((p) => p.code === plotCode);
    if (plot && plot.status !== "available") {
      return NextResponse.json(
        { error: "This property is sold out and can't be booked for inspection. Please choose an available plot." },
        { status: 400 }
      );
    }
  } else if (estate) {
    const estatePlots = BELGROVE_PLOTS.filter((p) => p.estate === estate);
    if (estatePlots.length > 0 && estatePlots.every((p) => p.status !== "available")) {
      return NextResponse.json(
        { error: "This estate is fully sold out. Please choose an available estate." },
        { status: 400 }
      );
    }
  }

  const preferredDateObj = new Date(preferredDate);
  if (Number.isNaN(preferredDateObj.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  // Preferred date should not be in the past (allow today) — Lagos calendar days.
  const { lagosDayKey, lagosTodayInput } = await import("@/lib/time");
  if (lagosDayKey(preferredDateObj) < lagosTodayInput()) {
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
  const { sendBookingReceived, sendAdminNewBookingAlert } = await import("@/lib/email/emailService");
  const { logServerError } = await import("@/lib/paymentConfirmation");
  const customerName = normalizeName(name) ?? name;
  const customerEmail = normalizeEmail(email) ?? email;
  const customerPhone = normalizePhoneE164(phone);
  const customer = await findOrCreateCustomer({ name: customerName, email: customerEmail, phone: customerPhone });
  // Admin/staff recipients for the alert + in-app notifications. Read once;
  // the rows are written inside the booking transaction below.
  const staffRecipients = await prisma.user
    .findMany({ where: { role: { in: ["admin", "staff"] } }, select: { id: true, email: true } })
    .catch((err) => {
      console.error("Admin/staff lookup failed (booking proceeds without alerts)", err);
      return [];
    });
  let booking;
  for (let attempt = 0; ; attempt++) {
    try {
      // One DB transaction: booking row + notifications. Emails send after
      // commit (below) — never inside the transaction.
      booking = await prisma.$transaction(async (tx) => {
        const created = await tx.inspectionBooking.create({
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
        // Visitor confirmation + admin alert send after commit (below).
        // Stable keys per booking: a retried submission that finds the same
        // booking never double-sends.
        if (staffRecipients.length > 0) {
          await tx.notification.createMany({
            data: staffRecipients.map((r) => ({
              userId: r.id,
              type: "new_booking",
              message: `New inspection booking ${created.ref} from ${created.name}`,
              bookingId: created.id,
            })),
          });
        }
        return created;
      });
      break;
    } catch (err) {
      if (isUniqueRefConflict(err) && attempt < 4) {
        ref = prefixedRef("BEL");
        continue;
      }
      throw err;
    }
  }

  // Direct sends after commit — email failure never fails the booking.
  const bookingLike = {
    name: booking.name,
    ref: booking.ref,
    preferredDate: booking.preferredDate,
    preferredTime: booking.preferredTime,
    location: booking.location,
    agentName: booking.agentName,
    phone: booking.phone,
    email: booking.email,
  };
  const visitorRes = await sendBookingReceived(booking.email, bookingLike, {
    idempotencyKey: `booking:${booking.id}:booking_received:${booking.email.toLowerCase()}`,
  });
  if (!visitorRes.sent) logServerError(`booking ${booking.ref}: visitor email failed`, visitorRes.error);
  if (staffRecipients.length > 0) {
    const adminRes = await sendAdminNewBookingAlert(
      staffRecipients.map((r) => r.email),
      bookingLike,
      { idempotencyKey: `booking:${booking.id}:admin_alert` }
    );
    if (!adminRes.sent) logServerError(`booking ${booking.ref}: admin alert failed`, adminRes.error);
  }

  return NextResponse.json({ ref: booking.ref, id: booking.id }, { status: 201 });
}
