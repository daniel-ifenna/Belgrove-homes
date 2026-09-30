import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { bookingActionSchema } from "@/lib/validation";
import { isTransitionAllowed, actionLabels, isEscalation } from "@/lib/booking-transitions";
import { isInternalRole } from "@/lib/authz";
import { scheduledInspectionStart } from "@/lib/inspection-time";
import type { EmailResult } from "@/lib/email/sendEmail";
import type { InspectionBooking, BookingStatus } from "@/generated/prisma/client";
import {
  getInterestedMessageText,
} from "@/lib/email/emailService";
import { logServerError, toUserFacingError } from "@/lib/paymentConfirmation";

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

// The inline outbox send runs after the response; allow headroom for the
// request's own DB work plus the post-response SMTP sends (Hobby max: 300s).
export const maxDuration = 30;

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    return await patchInner(request, ctx);
  } catch (e) {
    // Safety net: no booking action may fail with an empty/non-JSON 500.
    // Map to a friendly message; the full error stays server-side.
    logServerError("booking action", e);
    return NextResponse.json({ error: toUserFacingError(e, "booking") }, { status: 500 });
  }
}

async function patchInner(
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
  const emailResult: EmailResult = { sent: false, error: null };
  let emailAttempted = false;
  let emailQueued = false;
  const fromStatus: BookingStatus = booking.status;

  // Outbox delivery: enqueue (durable), then one inline send after the
  // response (scheduled at the tail of the handler). The request never
  // waits for SMTP; retries and failures live in EmailOutbox.
  // Repeatable admin actions pass a dedupeKey of action + new value +
  // updatedAt: a genuine repeat (new value) still sends, while a concurrent
  // double-submit (same updatedAt) collapses to one row.
  const outboxIds: string[] = [];
  async function queue(
    type: import("@/lib/email/outbox").OutboxType,
    to: string | string[],
    payload: Record<string, unknown>,
    dedupeKey?: string
  ) {
    const { enqueueEmail } = await import("@/lib/email/outbox");
    const row = await enqueueEmail(prisma, { type, to, payload, relatedType: "booking", relatedId: id, dedupeKey });
    outboxIds.push(row.id);
    emailQueued = true;
  }

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
      await queue(
        "booking_approved",
        updated.email,
        {
          to: updated.email,
          booking: { ...updated, preferredDate: confirmedDate, preferredTime: confirmedTime },
        },
        `booking:${id}:booking_approved:approved:${updated.updatedAt.getTime()}`
      );
      emailAttempted = true;
      note = input.note ? `${input.note}${shouldWarm ? " • Auto-warmed lead to warm" : ""}` : shouldWarm ? "Auto: lead warmed to warm on approval" : null;
      break;
    }

    case "reschedule": {
      const rescheduledDate = new Date(input.rescheduledDate);
      if (Number.isNaN(rescheduledDate.getTime())) {
        return NextResponse.json({ error: "Invalid rescheduled date" }, { status: 400 });
      }
      const { lagosDayKey, lagosTodayInput } = await import("@/lib/time");
      if (lagosDayKey(rescheduledDate) < lagosTodayInput()) {
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
        await queue(
          "booking_rescheduled",
          updated.email,
          {
            to: updated.email,
            booking: {
              name: updated.name,
              ref: updated.ref,
              rescheduledDate: updated.rescheduledDate!,
              rescheduledTime: updated.rescheduledTime!,
              location: updated.location,
            },
          },
          `booking:${id}:booking_rescheduled:${updated.rescheduledDate!.toISOString()}:${updated.rescheduledTime}:${updated.updatedAt.getTime()}`
        );
        emailAttempted = true;
        // Also notify assigned agent (follow-up requirement: both must receive)
        if (updated.agentId) {
          try {
            const agent = await prisma.agent.findUnique({ where: { id: updated.agentId } });
            if (agent) {
              await queue(
                "agent_rescheduled_notice",
                agent.email,
                {
                  to: agent.email,
                  params: {
                    agentName: agent.name,
                    ref: updated.ref,
                    clientName: updated.name,
                    rescheduledDate: updated.rescheduledDate!,
                    rescheduledTime: updated.rescheduledTime!,
                    location: updated.location,
                  },
                },
                `booking:${id}:agent_rescheduled_notice:${agent.email}:${updated.rescheduledDate!.toISOString()}:${updated.rescheduledTime}:${updated.updatedAt.getTime()}`
              );
              // Log agent notification separately for audit
              await prisma.bookingActivity.create({
                data: {
                  bookingId: id,
                  actorId,
                  actorName,
                  action: "reschedule_agent_notify",
                  fromStatus,
                  toStatus: updated.status,
                  note: `Agent ${agent.name} notified of new time ${input.rescheduledTime} on ${rescheduledDate.toDateString()} (queued)`,
                  emailSent: null,
                  emailError: null,
                },
              });
            }
          } catch (e) {
            console.error("Agent reschedule email queue failed:", e);
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
      await queue(
        "booking_status",
        updated.email,
        { to: updated.email, booking: updated, status: "on_hold" },
        `booking:${id}:booking_status:on_hold:${updated.updatedAt.getTime()}`
      );
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
      await queue(
        "booking_status",
        updated.email,
        { to: updated.email, booking: updated, status: "under_review" },
        `booking:${id}:booking_status:under_review:${input.assignedToId ?? "-"}:${updated.updatedAt.getTime()}`
      );
      emailAttempted = true;
      break;
    }

    case "mark_active": {
      // Inspection timing rule: the inspection cannot be marked complete
      // before its scheduled start unless an override reason is given
      // (recorded in the audit trail).
      const start = scheduledInspectionStart(booking);
      const override = (input as { overrideReason?: string }).overrideReason?.trim();
      if (start && new Date() < start && !override) {
        return NextResponse.json(
          { error: `The inspection is scheduled for ${start.toLocaleString("en-GB")}. Provide an override reason to mark it active early.` },
          { status: 400 }
        );
      }
      // internalNote now appends to InternalNote + activity; still store latest in internalNote for backward compat
      updated = await prisma.inspectionBooking.update({
        where: { id },
        data: { status: "active", internalNote: input.internalNote, inspectedAt: new Date() },
      });
      await prisma.internalNote.create({
        data: { bookingId: id, authorId: actorId, authorName: actorName, body: input.internalNote },
      });
      note = override ? `${input.internalNote} (early-activation override: ${override})` : input.internalNote;
      break;
    }

    case "record_outcome": {
      // New outcomes require a recorded inspection time — the inspection must
      // have been marked active first. (Legacy closed rows predate the rule.)
      if (!booking.inspectedAt) {
        return NextResponse.json(
          { error: "Record the inspection first (mark active) before recording an outcome." },
          { status: 400 }
        );
      }
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
        note = "Interested: auto hot, subscription form sent";
        if (input.note) note += ` ${input.note}`;
        const propertyName = booking.location;
        const text = getInterestedMessageText(propertyName);
        await queue(
          "interested_outcome",
          updated.email,
          {
            to: updated.email,
            params: { name: updated.name, ref: updated.ref, propertyName },
          },
          `booking:${id}:interested_outcome:${propertyName}:${updated.updatedAt.getTime()}`
        );
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
      // Order enforced: an Interested booking must confirm the subscription
      // form first (confirm_form), otherwise the panel could skip the step.
      if ((input.outcome === "sold" || input.outcome === "not_sold") && booking.outcome === "interested" && !booking.formConfirmedAt) {
        return NextResponse.json({ error: "Confirm the subscription form first, then record Sold / Not Sold." }, { status: 400 });
      }
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
        // No email at the raw Sold step by design (§2.3): the single
        // confirmation email fires at Transaction creation (form-confirmation
        // time), branched by payment plan. The timeline still records the close.
        note = "Sold: closing, confirmation email will fire on transaction creation";
        if (input.note) note += ` ${input.note}`;
        const soldText = `Congratulations! Your interest in ${booking.location} (ref ${booking.ref}) is now confirmed as SOLD. Our team will contact you within 24 hours with next steps and payment allocation details.`;
        await prisma.bookingMessage.create({
          data: { bookingId: id, authorId: null, authorName: "System", message: soldText },
        });
        await prisma.internalNote.create({
          data: { bookingId: id, authorId: null, authorName: "System", body: `[Sold] ${soldText}` },
        });
      } else {
        note = "Not sold: follow-up required, closing";
        if (input.note) note += ` ${input.note}`;
        // Automated not-sold response (queued, custom copy)
        const notSoldText = `Thank you for visiting ${booking.location} with Belgrove Homes (ref ${booking.ref}). We understand you’ve decided not to proceed at this time. Your feedback helps us serve you better. Your file remains warm for 30 days; reply to this email or call +234 810 376 0063 if you’d like to revisit, and we’ll keep you notified of similar plots.`;
        const notSoldSubject = `Following up on ${booking.location}: ${booking.ref}`;
        const notSoldHtml = `<div style="font-family:Inter, sans-serif; max-width:560px; margin:0 auto; color:#10231E;"><div style="background:#0D3328; padding:18px 20px; color:#C8A04A; font-weight:bold;">Belgrove Homes</div><div style="padding:20px; background:#fff; border:1px solid #E3E6E1;"><p>Hi ${updated.name},</p><p>${notSoldText}</p><p style="margin-top:16px; font-size:12px; color:#65736E;">Ref: ${updated.ref} • ${booking.location}</p></div></div>`;
        await queue(
          "not_sold_followup",
          updated.email,
          { to: updated.email, subject: notSoldSubject, html: notSoldHtml },
          `booking:${id}:not_sold_followup:not_sold:${updated.updatedAt.getTime()}`
        );
        emailAttempted = true;
        await prisma.bookingMessage.create({
          data: { bookingId: id, authorId: null, authorName: "System", message: notSoldText },
        });
        await prisma.internalNote.create({
          data: { bookingId: id, authorId: null, authorName: "System", body: `[Not Sold] ${notSoldText}` },
        });
      }
      break;
    }

    case "confirm_form": {
      // Subscription-form step: only after an Interested outcome, before Sold/Not Sold.
      if (booking.outcome !== "interested") {
        return NextResponse.json({ error: "Record Interested first, then confirm the form." }, { status: 400 });
      }
      if (booking.formConfirmedAt) {
        return NextResponse.json({ error: "Form already confirmed." }, { status: 400 });
      }
      updated = await prisma.inspectionBooking.update({
        where: { id },
        data: { formConfirmedAt: new Date(), reviewedById: actorId, reviewedAt: new Date() },
      });
      note = "Subscription form confirmed as filled — ready for Sold / Not Sold";
      if (input.note) note += ` ${input.note}`;
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
      if (booking.inspectedAt) {
        return NextResponse.json({ error: "Inspection already held — agent assignment is closed." }, { status: 400 });
      }
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
        // Fresh outcome cycle: the form step must be redone after reopen.
        data: { status: "active", lockedAt: null, outcome: null, formConfirmedAt: null },
      });
      note = `Reopened: ${input.reason}`;
      break;
    }

    case "assign_agent": {
      // Agent binding closes once the inspection has been held.
      if (booking.inspectedAt) {
        return NextResponse.json({ error: "Inspection already held — agent assignment is closed." }, { status: 400 });
      }
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
        if (input.note) note += `: ${input.note}`;
        break;
      }

      const agent = await prisma.agent.findUnique({ where: { id: input.agentId } });
      if (!agent) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      }
      if (!agent.isActive) {
        return NextResponse.json({ error: "Agent is deactivated" }, { status: 400 });
      }

      // Agent self-assignment guard: the agent must not be the customer.
      // Email match always blocks. Phone match no longer blocks — an agent
      // may share the customer's phone (shared handset) with no override.
      if (agent.email.trim().toLowerCase() === booking.email.trim().toLowerCase()) {
        return NextResponse.json(
          { error: "This agent's email matches the booking customer's email. Assign a different agent." },
          { status: 400 }
        );
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
            message: `Assigned to ${agent.name}: ${input.note.trim()}`,
          },
        });
      }

      if (!input.silent) {
        await queue(
          "agent_assignment",
          agent.email,
          {
            to: agent.email,
            params: {
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
            },
          },
          `booking:${id}:agent_assignment:${agent.id}:${updated.updatedAt.getTime()}`
        );
        emailAttempted = true;
      }

      note = `Assigned to ${agent.name} (${agent.category.replace("_", " ")})${input.silent ? " silent" : ""}`;
      if (input.note) note += `: ${input.note}`;
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
    case "update_property": {
      const data: any = {};
      if (input.estate !== undefined) data.estate = input.estate || null;
      if (input.plotCode !== undefined) data.plotCode = input.plotCode || null;
      if (input.unitType !== undefined) data.unitType = input.unitType || null;
      if (input.sqm !== undefined) data.sqm = input.sqm;
      if (input.sqmNeeded !== undefined) data.sqmNeeded = input.sqmNeeded;
      if (input.selectionType !== undefined) data.selectionType = input.selectionType;
      if (input.plotQuantity !== undefined) data.plotQuantity = input.plotQuantity;
      if (input.unitPrice !== undefined) data.unitPrice = input.unitPrice;
      // keep location in sync if estate/plot changed and no explicit location
      if (data.estate || data.plotCode || data.sqm || data.sqmNeeded) {
        const cur = booking;
        const estate = data.estate ?? cur.estate ?? "";
        const plotCode = data.plotCode ?? cur.plotCode ?? "";
        const sqm = data.sqm ?? cur.sqm ?? data.sqmNeeded ?? cur.sqmNeeded ?? null;
        if (estate && sqm) {
          data.location = data.selectionType === "sqm_needed" || (!plotCode && sqm) ? `${estate} · ${sqm}sqm requested` : `${estate}${plotCode ? ` · ${plotCode}` : ""}${sqm ? ` · ${sqm}sqm` : ""}`.trim();
        } else if (estate && plotCode) {
          data.location = `${estate} · ${plotCode}`;
        }
      }
      if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: "No property fields to update" }, { status: 400 });
      }
      updated = await prisma.inspectionBooking.update({ where: { id }, data });
      note = `Updated property: ${Object.keys(data).join(", ")}: ${JSON.stringify(data)}`;
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
      note: emailQueued && note ? `${note} (email queued)` : note,
      emailSent: emailQueued ? null : emailAttempted ? emailResult.sent : null,
      emailError: emailQueued ? "queued via outbox" : emailResult.error,
    },
  });

  // Inline send after the response — every write above has committed.
  const { scheduleInlineOutboxSend } = await import("@/lib/email/outbox");
  scheduleInlineOutboxSend(outboxIds);

  return NextResponse.json({ booking: updated, emailResult, emailQueued });
}
