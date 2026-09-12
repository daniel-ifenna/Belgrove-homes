import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { sendAgentFollowUp } from "@/lib/email/emailService";

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

  // Follow-up with assigned agent: send message to agent email for follow-ups
  if (booking.agentId) {
    try {
      const agent = await prisma.agent.findUnique({ where: { id: booking.agentId } });
      if (agent) {
        const emailRes = await sendAgentFollowUp(agent.email, {
          agentName: agent.name,
          clientName: booking.name,
          ref: booking.ref,
          location: booking.location,
          message,
          authorName,
        });
        await prisma.bookingActivity.create({
          data: {
            bookingId: id,
            actorId: authorId,
            actorName: authorName,
            action: "message_to_agent",
            fromStatus: booking.status,
            toStatus: booking.status,
            note: `Sent to ${agent.name} <${agent.email}>: ${message.slice(0, 500)}`,
            emailSent: emailRes.sent,
            emailError: emailRes.error,
          },
        });
      }
    } catch (e) {
      console.error("Agent follow-up email failed:", e);
    }
  }

  return NextResponse.json({ message: msg }, { status: 201 });
}
