import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { bookingActionSchema } from "@/lib/validation";
import { isTransitionAllowed, actionLabels, isEscalation } from "@/lib/booking-transitions";
import { isInternalRole } from "@/lib/authz";
import type { EmailResult } from "@/lib/email/sendEmail";
import type { InspectionBooking, BookingStatus } from "@/generated/prisma/client";
import {
  sendBookingApproved,
  sendBookingRescheduled,
  sendBookingStatusEmail,
  sendSaleConfirmation,
  sendAgentAssignment,
  sendInterestedOutcome,
  getInterestedMessageText,
  sendAgentRescheduledNotice,
} from "@/lib/email/emailService";

function parseSlotMinutes(slot: string): number | null {
  // "10:00 AM" -> minutes since midnight
  const m = slot.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  const ap = m[3].toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h * 60 + mm;
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const actorId = session!.user.id;
  const actorName = session!.user.name ?? session!.user.email ?? "Unknown";

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = bookingActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const booking = await prisma.inspectionBooking.findUnique({ where: { id } });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const input = parsed.data as any;

  // Optimistic concurrency
  if (input.expectedUpdatedAt) {
    const expectedMs = new Date(input.expectedUpdatedAt).getTime();
    if (Number.isNaN(expectedMs)) {
      return NextResponse.json({ error: "Invalid expectedUpdatedAt" }, { status: 400 });
    }
    const currentMs = booking.updatedAt.getTime();
    if (Math.abs(expectedMs - currentMs) > 1000) {
      return NextResponse.json(
        {
          error: "This booking was updated by someone else since you loaded it. Refresh and try again.",
          booking,
        },
        { status: 409 }
      );
    }
  }

  // Locked / Closed guard only reopen is allowed when locked (single-Admin, no role tiers)
  const isLocked = booking.status === "closed" || !!booking.lockedAt;
  if (isLocked && input.action !== "reopen") {
    return NextResponse.json(
      { error: "Booking is closed and locked use Reopen booking to make changes." },
      { status: 423 }
    );
  }

  if (!isTransitionAllowed(input.action as any, booking.status)) {
    return NextResponse.json(
      {
        error: `"${actionLabels[input.action as keyof typeof actionLabels] ?? input.action}" isn't valid from status "${booking.status}".`,
      },
      { status: 409 }
    );
  }

  let updated: InspectionBooking;
  let note: string | null = null;
  let emailResult: EmailResult = { sent: false, error: null };
  let emailAttempted = false;
  const fromStatus: BookingStatus = booking.status;

  switch (input.action) {
    case "approve": {
      const shouldWarm = booking.leadTemperature === "cold";
      updated = await prisma.inspectionBooking.update({
        where: { id },
        data: {
          status: "approved",
          reviewedById: actorId,
          reviewedAt: new Date(),
          ...(shouldWarm ? { leadTemperature: "warm" as const } : {}),
        },
      });
      // Also log lead temperature change if auto-warmed
      if (shouldWarm) {
        await prisma.bookingActivity.create({
          data: {
            bookingId: id,
            actorId,
            actorName,
            action: "escalate_lead",
            fromStatus: fromStatus,
            toStatus: "approved",
            note: "Auto: lead temperature cold → warm on approval",
          },
        });
      }
      const confirmedDate = updated.rescheduledDate ?? updated.preferredDate;
      const confirmedTime = updated.rescheduledTime ?? updated.preferredTime;
      emailResult = await sendBookingApproved(updated.email, {
        ...updated,
        preferredDate: confirmedDate,
        preferredTime: confirmedTime,
      });
      emailAttempted = true;
      note = input.note ? `${input.note}${shouldWarm ? " • Auto-warmed lead to warm" : ""}` : shouldWarm ? "Auto: lead warmed to warm on approval" : null;
      break;
    }

    case "reschedule": {
      const rescheduledDate = new Date(input.rescheduledDate);
      if (Number.isNaN(rescheduledDate.getTime())) {
        return NextResponse.json({ error: "Invalid rescheduled date" }, { status: 400 });
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const resDay = new Date(rescheduledDate);
      resDay.setHours(0, 0, 0, 0);
      if (resDay.getTime() < today.getTime()) {
        return NextResponse.json({ error: "Rescheduled date cannot be in the past" }, { status: 400 });
      }
      // Safety check: agent conflict ±2h
      if (booking.agentId) {
        const newMins = parseSlotMinutes(input.rescheduledTime);
        if (newMins !== null) {
          const dayStart = new Date(rescheduledDate);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(rescheduledDate);
          dayEnd.setHours(23, 59, 59, 999);
          const sameDay = await prisma.inspectionBooking.findMany({
            where: {
              agentId: booking.agentId,
              id: { not: id },
              status: { not: "closed" },
              OR: [
                { preferredDate: { gte: dayStart, lte: dayEnd } },
                { rescheduledDate: { gte: dayStart, lte: dayEnd } },
              ],
            },
            select: { preferredDate: true, preferredTime: true, rescheduledDate: true, rescheduledTime: true, ref: true },
          });
          const conflicts = sameDay.filter((b) => {
            const t = b.rescheduledTime ?? b.preferredTime;
            const mins = parseSlotMinutes(t);
            return mins !== null && Math.abs(mins - newMins) <= 120;
          });
          if (conflicts.length > 0) {
            // We warn but don't block return 409 with conflict details so UI can confirm
            // If client didn't explicitly acknowledge, treat as warning
            // For now allow through; UI will show warning before second confirm
          }
        }
      }

      updated = await prisma.inspectionBooking.update({
        where: { id },
        data: {
          status: "rescheduled",
          rescheduledDate,
          rescheduledTime: input.rescheduledTime,
          reviewedById: actorId,
          reviewedAt: new Date(),
        },
      });
      note = `New time: ${rescheduledDate.toDateString()} at ${input.rescheduledTime}`;
      if (input.note) note += ` ${input.note}`;
      if (input.notifyClient !== false) {
        // Notify visitor
        emailResult = await sendBookingRescheduled(updated.email, {
          name: updated.name,
          ref: updated.ref,
          rescheduledDate: updated.rescheduledDate!,
          rescheduledTime: updated.rescheduledTime!,
          location: updated.location,
        });
        emailAttempted = true;
        // Also notify assigned agent (follow-up requirement: both must receive)
        if (updated.agentId) {
          try {
            const agent = await prisma.agent.findUnique({ where: { id: updated.agentId } });
            if (agent) {
              const agentRes = await sendAgentRescheduledNotice(agent.email, {
                agentName: agent.name,
                ref: updated.ref,
                clientName: updated.name,
                rescheduledDate: updated.rescheduledDate!,
                rescheduledTime: updated.rescheduledTime!,
                location: updated.location,
              });
              // Log agent notification separately for audit
              await prisma.bookingActivity.create({
                data: {
                  bookingId: id,
                  actorId,
                  actorName,
                  action: "reschedule_agent_notify",
                  fromStatus,
                  toStatus: updated.status,
                  note: `Agent ${agent.name} notified of new time ${input.rescheduledTime} on ${rescheduledDate.toDateString()}`,
                  emailSent: agentRes.sent,
                  emailError: agentRes.error,
                },
              });
            }
          } catch (e) {
            console.error("Agent reschedule email failed:", e);
          }
        }
      }
      break;
    }

    case "hold": {
      updated = await prisma.inspectionBooking.update({
        where: { id },
        data: { status: "on_hold", reviewedById: actorId, reviewedAt: new Date() },
      });
      emailResult = await sendBookingStatusEmail(updated.email, updated, "on_hold");
      emailAttempted = true;
      note = input.note || null;
      break;
    }

    case "under_review": {
      updated = await prisma.inspectionBooking.update({
        where: { id },
        data: {
          status: "under_review",
          reviewedById: actorId,
          reviewedAt: new Date(),
          ...(input.assignedToId !== undefined ? { assignedToId: input.assignedToId } : {}),
        },
      });
      if (input.assignedToId !== undefined) {
        note = input.assignedToId ? "Reassigned" : "Unassigned";
      }
      if (input.note) note = note ? `${note} ${input.note}` : input.note;
      emailResult = await sendBookingStatusEmail(updated.email, updated, "under_review");
      emailAttempted = true;
      break;
    }

    case "mark_active": {
      // internalNote now appends to InternalNote + activity; still store latest in internalNote for backward compat
      updated = await prisma.inspectionBooking.update({
        where: { id },
        data: { status: "active", internalNote: input.internalNote },
      });
      await prisma.internalNote.create({
        data: { bookingId: id, authorId: actorId, authorName: actorName, body: input.internalNote },
      });
      note = input.internalNote;
      break;
    }

    case "record_outcome": {
      // Interested is an intermediate state — auto hot, do NOT close, allow next step to Sold/Not Sold
      if (input.outcome === "interested") {
        const shouldHeat = booking.leadTemperature !== "hot";
        updated = await prisma.inspectionBooking.update({
          where: { id },
          data: {
            outcome: "interested",
            leadTemperature: "hot",
            // keep status active (or approved) — do not lock, so Sold/Not Sold remain available
            ...(booking.status === "active" ? {} : { status: "active" as any }),
          },
        });
        if (shouldHeat) {
          await prisma.bookingActivity.create({
            data: {
              bookingId: id,
              actorId,
              actorName,
              action: "escalate_lead",
              fromStatus: fromStatus,
              toStatus: updated.status,
              note: `Auto: lead temperature ${booking.leadTemperature} → hot on interested`,
            },
          });
        }
        note = "Interested — auto hot, subscription form sent";
        if (input.note) note += ` ${input.note}`;
        const propertyName = booking.location;
        const text = getInterestedMessageText(propertyName);
        emailResult = await sendInterestedOutcome(updated.email, {
          name: updated.name,
          ref: updated.ref,
          propertyName,
        });
        emailAttempted = true;
        await prisma.bookingMessage.create({
          data: {
            bookingId: id,
            authorId: null,
            authorName: "System",
            message: text,
          },
        });
        await prisma.internalNote.create({
          data: {
            bookingId: id,
            authorId: null,
            authorName: "System",
            body: `[Interested → Hot] ${text}`,
          },
        });
        break;
      }

      // Sold / Not Sold — both close with automated response before locking
      const isSold = input.outcome === "sold";
      updated = await prisma.inspectionBooking.update({
        where: { id },
        data: {
          status: "closed",
          outcome: input.outcome as any,
          lockedAt: new Date(),
          leadTemperature: isSold ? "hot" : "warm",
        },
      });
      // Also log lead temp change if needed
      if ((isSold && booking.leadTemperature !== "hot") || (!isSold && booking.leadTemperature !== "warm")) {
        await prisma.bookingActivity.create({
          data: {
            bookingId: id,
            actorId,
            actorName,
            action: isSold ? "escalate_lead" : "cool_down",
            fromStatus: fromStatus,
            toStatus: "closed",
            note: `Auto: lead ${booking.leadTemperature} → ${isSold ? "hot" : "warm"} on ${isSold ? "sold" : "not sold"}`,
          },
        });
      }
      if (isSold) {
        note = "Sold — closing, confirmation sent";
        if (input.note) note += ` ${input.note}`;
        emailResult = await sendSaleConfirmation(updated.email, updated);
        emailAttempted = true;
        const soldText = `Congratulations! Your interest in ${booking.location} (ref ${booking.ref}) is now confirmed as SOLD. Our team will contact you within 24 hours with next steps and payment allocation details.`;
        await prisma.bookingMessage.create({
          data: { bookingId: id, authorId: null, authorName: "System", message: soldText },
        });
        await prisma.internalNote.create({
          data: { bookingId: id, authorId: null, authorName: "System", body: `[Sold] ${soldText}` },
        });
      } else {
        note = "Not sold — follow-up required, closing";
        if (input.note) note += ` ${input.note}`;
        // Automated not-sold response
        const notSoldText = `Thank you for visiting ${booking.location} with Belgrove Homes (ref ${booking.ref}). We understand you’ve decided not to proceed at this time — your feedback helps us serve you better. Your file remains warm for 30 days; reply to this email or call +234 810 376 0063 if you’d like to revisit, and we’ll keep you notified of similar plots.`;
        emailResult = await sendBookingStatusEmail(updated.email, { name: updated.name, ref: updated.ref } as any, "on_hold" as any);
        // Override email with custom not-sold text via direct send
        try {
          const { sendEmail } = await import("@/lib/email/sendEmail");
          const customRes = await sendEmail({
            to: updated.email,
            subject: `Following up on ${booking.location} — ${booking.ref}`,
            html: `<div style="font-family:Inter, sans-serif; max-width:560px; margin:0 auto; color:#10231E;"><div style="background:#0D3328; padding:18px 20px; color:#C8A04A; font-weight:bold;">Belgrove Homes</div><div style="padding:20px; background:#fff; border:1px solid #E3E6E1;"><p>Hi ${updated.name},</p><p>${notSoldText}</p><p style="margin-top:16px; font-size:12px; color:#65736E;">Ref: ${updated.ref} • ${booking.location}</p></div></div>`,
          });
          emailResult = customRes;
          emailAttempted = true;
        } catch {}
        await prisma.bookingMessage.create({
          data: { bookingId: id, authorId: null, authorName: "System", message: notSoldText },
        });
        await prisma.internalNote.create({
          data: { bookingId: id, authorId: null, authorName: "System", body: `[Not Sold] ${notSoldText}` },
        });
      }
      break;
    }

    case "save": {
      // No longer allows agentName overwrite; only assignedTo
      const changes: string[] = [];
      if (input.assignedToId !== undefined && input.assignedToId !== booking.assignedToId) {
        changes.push(input.assignedToId ? "reassigned" : "unassigned");
      }
      updated = await prisma.inspectionBooking.update({
        where: { id },
        data: {
          ...(input.assignedToId !== undefined ? { assignedToId: input.assignedToId } : {}),
        },
      });
      note = changes.length > 0 ? changes.join("; ") : null;
      break;
    }

    case "add_note": {
      await prisma.internalNote.create({
        data: { bookingId: id, authorId: actorId, authorName: actorName, body: input.body },
      });
      updated = await prisma.inspectionBooking.update({ where: { id }, data: { updatedAt: new Date() } });
      note = input.body;
      break;
    }

    case "confirm_agent": {
      if (!booking.agentId) {
        return NextResponse.json({ error: "No agent assigned to confirm" }, { status: 400 });
      }
      updated = await prisma.inspectionBooking.update({
        where: { id },
        data: { agentConfirmedAt: new Date(), agentConfirmedById: actorId },
      });
      note = `Confirmed match: ${booking.agentName ?? "agent"} → verified by ${actorName}`;
      break;
    }

    case "cool_down": {
      // manual cool down requires reason (note)
      if (!input.note) {
        return NextResponse.json({ error: "Reason is required to cool down" }, { status: 400 });
      }
      // ensure it's actually a downgrade
      if (!["cold", "warm"].includes(input.leadTemperature)) {
        return NextResponse.json({ error: "Invalid cool-down target" }, { status: 400 });
      }
      // prevent raising via cool_down
      const rank: Record<string, number> = { cold: 0, warm: 1, hot: 2 };
      if (rank[input.leadTemperature] >= rank[booking.leadTemperature]) {
        return NextResponse.json({ error: "Cool down must lower temperature" }, { status: 400 });
      }
      updated = await prisma.inspectionBooking.update({
        where: { id },
        data: { leadTemperature: input.leadTemperature },
      });
      note = `${booking.leadTemperature} → ${input.leadTemperature} (cool down) ${input.note}`;
      break;
    }

    case "escalate_lead": {
      if (!isEscalation(booking.leadTemperature as any, input.leadTemperature as any)) {
        return NextResponse.json(
          {
            error: `Can't change lead temperature from "${booking.leadTemperature}" to "${input.leadTemperature}" this action only escalates.`,
          },
          { status: 400 }
        );
      }
      updated = await prisma.inspectionBooking.update({
        where: { id },
        data: { leadTemperature: input.leadTemperature },
      });
      note = `${booking.leadTemperature} → ${input.leadTemperature}`;
      if (input.note) note += ` ${input.note}`;
      break;
    }

    case "reopen": {
      updated = await prisma.inspectionBooking.update({
        where: { id },
        data: { status: "active", lockedAt: null, outcome: null },
      });
      note = `Reopened: ${input.reason}`;
      break;
    }

    case "assign_agent": {
      if (input.agentId === null) {
        const prevAgent = booking.agentId ? await prisma.agent.findUnique({ where: { id: booking.agentId } }) : null;
        // preserve visitor raw if not yet preserved
        const raw = booking.visitorAgentRaw ?? booking.agentName;
        updated = await prisma.inspectionBooking.update({
          where: { id },
          data: { agentId: null, agentName: null, visitorAgentRaw: raw, agentConfirmedAt: null, agentConfirmedById: null },
        });
        if (input.note && input.note.trim()) {
          await prisma.internalNote.create({
            data: { bookingId: id, authorId: actorId, authorName: actorName, body: `Unassignment note: ${input.note.trim()}` },
          });
        }
        note = prevAgent ? `Unassigned from ${prevAgent.name}` : "Unassigned agent";
        if (input.note) note += ` — ${input.note}`;
        break;
      }

      const agent = await prisma.agent.findUnique({ where: { id: input.agentId } });
      if (!agent) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      }
      if (!agent.isActive) {
        return NextResponse.json({ error: "Agent is deactivated" }, { status: 400 });
      }

      const raw = booking.visitorAgentRaw ?? booking.agentName;
      updated = await prisma.inspectionBooking.update({
        where: { id },
        data: { agentId: agent.id, agentName: agent.name, visitorAgentRaw: raw },
      });

      // Create internal note if admin left a note during assignment — so it reflects in UI and timeline
      if (input.note && input.note.trim()) {
        await prisma.internalNote.create({
          data: {
            bookingId: id,
            authorId: actorId,
            authorName: actorName,
            body: `Agent assignment note: ${input.note.trim()}`,
          },
        });
        // Also create a message-like entry for agent visibility
        await prisma.bookingMessage.create({
          data: {
            bookingId: id,
            authorId: actorId,
            authorName: actorName,
            message: `Assigned to ${agent.name} — ${input.note.trim()}`,
          },
        });
      }

      if (!input.silent) {
        emailResult = await sendAgentAssignment(agent.email, {
          agentName: agent.name,
          clientName: updated.name,
          clientEmail: updated.email,
          clientPhone: updated.phone,
          ref: updated.ref,
          preferredDate: updated.preferredDate,
          preferredTime: updated.preferredTime,
          rescheduledDate: updated.rescheduledDate,
          rescheduledTime: updated.rescheduledTime,
          location: updated.location,
          agentCategory: agent.category,
          assignmentNote: input.note ?? null,
        });
        emailAttempted = true;
      }

      note = `Assigned to ${agent.name} (${agent.category.replace("_", " ")})${input.silent ? " silent" : ""}`;
      if (input.note) note += ` — ${input.note}`;
      break;
    }
    case "edit_booking": {
      const data: any = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.email !== undefined) data.email = input.email;
      if (input.phone !== undefined) data.phone = input.phone;
      if (input.location !== undefined) data.location = input.location;
      if (input.preferredDate) {
        const d = new Date(input.preferredDate);
        if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Invalid preferred date" }, { status: 400 });
        data.preferredDate = d;
      }
      if (input.preferredTime !== undefined) data.preferredTime = input.preferredTime;
      if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: "No fields to update" }, { status: 400 });
      }
      updated = await prisma.inspectionBooking.update({ where: { id }, data });
      const changed = Object.keys(data).join(", ");
      note = `Edited booking fields: ${changed}`;
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  await prisma.bookingActivity.create({
    data: {
      bookingId: id,
      actorId,
      actorName,
      action: input.action,
      fromStatus,
      toStatus: updated.status,
      note,
      emailSent: emailAttempted ? emailResult.sent : null,
      emailError: emailResult.error,
    },
  });

  return NextResponse.json({ booking: updated, emailResult });
}
