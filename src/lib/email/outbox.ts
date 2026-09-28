import { prisma } from "@/lib/prisma";
import type { EmailResult } from "./sendEmail";
import { logServerError } from "@/lib/paymentConfirmation";

// Durable email outbox. Call sites enqueue a row (inside the business DB
// transaction where possible) and never await delivery. processOutbox()
// delivers due rows with exponential backoff: attempts 1..5, then FAILED.
// A non-blocking kickOutbox() after enqueue covers the common case; production
// also runs POST /api/cron/outbox every minute (CRON_SECRET).

export const MAX_ATTEMPTS = 5;
export const BATCH_SIZE = 25;

export type OutboxType =
  | "booking_received"
  | "admin_booking_alert"
  | "booking_approved"
  | "booking_rescheduled"
  | "agent_rescheduled_notice"
  | "booking_status"
  | "interested_outcome"
  | "not_sold_followup"
  | "agent_assignment"
  | "agent_followup"
  | "transaction_confirmation"
  | "receipt";

export type EnqueueInput = {
  type: OutboxType;
  to: string | string[];
  subject?: string;
  payload: Record<string, unknown>;
  relatedType?: string;
  relatedId?: string;
};

export type OutboxWriter = {
  emailOutbox: {
    create(args: unknown): Promise<{ id: string }>;
  };
};

// Pure: minutes to wait before attempt N (1-based) → 2, 4, 8, 16, 32.
export function computeBackoffMinutes(attempts: number): number {
  return 2 ** Math.max(1, attempts);
}

export async function enqueueEmail(db: OutboxWriter, input: EnqueueInput): Promise<{ id: string }> {
  return db.emailOutbox.create({
    data: {
      type: input.type,
      to: input.to,
      subject: input.subject ?? null,
      payload: input.payload,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
    },
  });
}

export type OutboxSender = (type: OutboxType, to: string | string[], payload: Record<string, unknown>) => Promise<EmailResult>;

type OutboxRow = {
  id: string;
  type: string;
  to: unknown;
  payload: unknown;
  attempts: number;
  status: string;
};

export type ProcessDb = {
  emailOutbox: {
    findMany(args: unknown): Promise<OutboxRow[]>;
    updateMany(args: unknown): Promise<{ count: number }>;
    update(args: unknown): Promise<unknown>;
  };
};

const realDb = prisma as unknown as ProcessDb & OutboxWriter;

async function defaultSender(type: OutboxType, to: string | string[], payload: Record<string, unknown>): Promise<EmailResult> {
  const {
    sendBookingReceived,
    sendAdminNewBookingAlert,
    sendBookingApproved,
    sendBookingRescheduled,
    sendAgentRescheduledNotice,
    sendBookingStatusEmail,
    sendInterestedOutcome,
    sendAgentAssignment,
    sendAgentFollowUp,
    sendTransactionConfirmation,
  } = await import("./emailService");
  const p = payload as Record<string, unknown>;
  const asParams = <T>(v: unknown): T => v as T;
  switch (type) {
    case "booking_received":
      return sendBookingReceived(to as string, asParams(p.booking));
    case "admin_booking_alert":
      return sendAdminNewBookingAlert(to as string[], asParams(p.booking));
    case "booking_approved":
      return sendBookingApproved(to as string, asParams(p.booking));
    case "booking_rescheduled":
      return sendBookingRescheduled(to as string, asParams(p.booking));
    case "agent_rescheduled_notice":
      return sendAgentRescheduledNotice(to as string, asParams(p.params));
    case "booking_status":
      return sendBookingStatusEmail(to as string, p.booking as { name: string; ref: string }, p.status as "on_hold" | "under_review");
    case "interested_outcome":
      return sendInterestedOutcome(to as string, asParams(p.params));
    case "not_sold_followup": {
      const { sendEmail } = await import("./sendEmail");
      return sendEmail({ to, subject: asParams<string>(p.subject), html: asParams<string>(p.html) });
    }
    case "agent_assignment":
      return sendAgentAssignment(to as string, asParams(p.params));
    case "agent_followup":
      return sendAgentFollowUp(to as string, asParams(p.params));
    case "transaction_confirmation":
      return sendTransactionConfirmation(to as string, asParams(p.params));
    case "receipt": {
      const { sendReceiptForOutbox } = await import("./receiptOutboxSender");
      return sendReceiptForOutbox(p.receiptId as string);
    }
    default:
      return { sent: false, error: `Unknown outbox type: ${type}` };
  }
}

export async function processOutbox(
  opts: { sender?: OutboxSender; now?: Date; batchSize?: number; db?: ProcessDb } = {}
): Promise<{ sent: number; failed: number; deferred: number }> {
  const db = opts.db ?? realDb;
  const sender = opts.sender ?? defaultSender;
  const now = opts.now ?? new Date();
  const batchSize = opts.batchSize ?? BATCH_SIZE;
  const result = { sent: 0, failed: 0, deferred: 0 };

  const due = await db.emailOutbox.findMany({
    where: {
      status: { in: ["PENDING", "SENDING"] },
      nextAttemptAt: { lte: now },
      attempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  for (const row of due) {
    // Atomic claim so two workers never double-send.
    const claimed = await db.emailOutbox.updateMany({
      where: { id: row.id, status: { in: ["PENDING", "SENDING"] } },
      data: { status: "SENDING" },
    });
    if (claimed.count === 0) continue;
    let outcome: EmailResult;
    try {
      outcome = await sender(row.type as OutboxType, row.to as string | string[], (row.payload ?? {}) as Record<string, unknown>);
    } catch (e) {
      outcome = { sent: false, error: e instanceof Error ? e.message : "Outbox sender threw" };
    }
    const attempts = row.attempts + 1;
    if (outcome.sent) {
      result.sent++;
      await db.emailOutbox.update({
        where: { id: row.id },
        data: { status: "SENT", attempts, sentAt: now, lastError: null },
      });
    } else if (attempts >= MAX_ATTEMPTS) {
      result.failed++;
      await db.emailOutbox.update({
        where: { id: row.id },
        data: { status: "FAILED", attempts, lastError: (outcome.error ?? "failed").slice(0, 1000) },
      });
    } else {
      result.deferred++;
      await db.emailOutbox.update({
        where: { id: row.id },
        data: {
          status: "PENDING",
          attempts,
          nextAttemptAt: new Date(now.getTime() + computeBackoffMinutes(attempts) * 60_000),
          lastError: (outcome.error ?? "failed").slice(0, 1000),
        },
      });
    }
  }
  return result;
}

// Fire-and-forget delivery kick after enqueue. Never throws, never blocks.
export function kickOutbox(): void {
  processOutbox().then(
    (r) => {
      if (r.sent + r.failed > 0) console.log(`[outbox] kick delivered: sent=${r.sent} failed=${r.failed} deferred=${r.deferred}`);
    },
    (e) => logServerError("outbox kick failed", e)
  );
}
