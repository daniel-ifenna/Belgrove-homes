import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";

// The inline outbox send runs after the response; allow headroom for the
// request's own DB work plus the post-response SMTP send (Hobby max: 300s).
export const maxDuration = 30;

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const booking = await prisma.inspectionBooking.findUnique({ where: { id }, select: { id: true } });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const messages = await prisma.bookingMessage.findMany({
    where: { bookingId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const booking = await prisma.inspectionBooking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // Messaging is available until booking is closed after closed it's read-only (spec).
  if (booking.status === "closed") {
    return NextResponse.json({ error: "Booking is closed messaging is read-only" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });
  if (message.length > 5000) return NextResponse.json({ error: "Message too long (max 5000)" }, { status: 400 });

  const authorId = session!.user.id;
  const authorName = session!.user.name ?? session!.user.email ?? "Unknown";

  const msg = await prisma.bookingMessage.create({
    data: {
      bookingId: id,
      authorId,
      authorName,
      message,
    },
  });

  // Also append to activity timeline for audit continuity
  await prisma.bookingActivity.create({
    data: {
      bookingId: id,
      actorId: authorId,
      actorName: authorName,
      action: "message",
      fromStatus: booking.status,
      toStatus: booking.status,
      note: message.slice(0, 1000),
    },
  });

  // Follow-up with assigned agent: queue message to agent email for follow-ups
  if (booking.agentId) {
    try {
      const agent = await prisma.agent.findUnique({ where: { id: booking.agentId } });
      if (agent) {
        const { enqueueEmail, scheduleInlineOutboxSend } = await import("@/lib/email/outbox");
        // One row per message: the default key would swallow a second,
        // different message to the same agent, so key on the message id.
        const row = await enqueueEmail(prisma, {
          type: "agent_followup",
          to: agent.email,
          payload: {
            to: agent.email,
            params: {
              agentName: agent.name,
              clientName: booking.name,
              ref: booking.ref,
              location: booking.location,
              message,
              authorName,
            },
          },
          relatedType: "booking",
          relatedId: id,
          dedupeKey: `booking:${id}:agent_followup:${msg.id}`,
        });
        scheduleInlineOutboxSend([row.id]);
        await prisma.bookingActivity.create({
          data: {
            bookingId: id,
            actorId: authorId,
            actorName: authorName,
            action: "message_to_agent",
            fromStatus: booking.status,
            toStatus: booking.status,
            note: `Queued to ${agent.name} <${agent.email}>: ${message.slice(0, 500)}`,
            emailSent: null,
            emailError: "queued via outbox",
          },
        });
      }
    } catch (e) {
      console.error("Agent follow-up email queue failed:", e);
    }
  }

  return NextResponse.json({ message: msg }, { status: 201 });
}
