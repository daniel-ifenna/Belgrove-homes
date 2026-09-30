import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import type { EmailResult } from "./sendEmail";
import { logServerError } from "@/lib/paymentConfirmation";

// Durable email outbox, cron-free. Call sites enqueue rows first (inside the
// business DB transaction where possible) so the mail is durable, then
// schedule an inline send via scheduleInlineOutboxSend() — after() runs it
// after the response, so delivery starts within seconds without delaying the
// request. Anything the inline send misses is retried by later inline sends
// (every enqueue drains due rows too), by the admin-inbox-load drain, by the
// per-row Retry button, or manually via /api/cron/outbox — with exponential
// backoff (attempts 1..5, then FAILED).

export const MAX_ATTEMPTS = 5;
export const BATCH_SIZE = 20;
// In-process retries after a failed send, before deferring the row: waits of
// 2s then 5s (worst case ~7s + send time per row, inside maxDuration = 30).
export const INLINE_RETRY_WAITS_MS = [2000, 5000];
// A row claimed as SENDING but untouched for this long belongs to a worker
// that died mid-send (e.g. serverless freeze after the response). The reaper
// below resets it to PENDING so the next run retries instead of wedging.
// Short now that every send path has a hard timeout well under maxDuration.
export const STALE_SENDING_MINUTES = 3;

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
  // Caller-supplied dedupe key. When omitted, the default key
  // (relatedType:relatedId:type:recipients) is used — right for naturally
  // once-only mail (one row per booking/transaction/receipt). Repeatable
  // admin actions must pass an override that includes the action, the new
  // value, and the row's updatedAt, so a genuine repeat still sends.
  dedupeKey?: string;
  // Explicit user actions (e.g. receipt resend) bypass dedupe entirely.
  force?: boolean;
};

export type OutboxWriter = {
  emailOutbox: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
  };
};

// Pure: deterministic dedupe key for an enqueue. Recipients are lowercased
// and sorted so ["a","B"] and ["B","a"] key identically.
// Pure: minutes to wait before attempt N (1-based) → 0.5, 2, 8, 32, 128.
// The first retry comes fast (30s) so a transient provider stall recovers in
// about a minute; later waits grow while the MAX_ATTEMPTS guard is unchanged.
const BACKOFF_MINUTES = [0.5, 2, 8, 32, 128];
export function computeBackoffMinutes(attempts: number): number {
  const idx = Math.min(Math.max(1, attempts), BACKOFF_MINUTES.length) - 1;
  return BACKOFF_MINUTES[idx];
}

export function computeDedupeKey(input: {
  type: OutboxType;
  to: string | string[];
  relatedType?: string;
  relatedId?: string;
}): string {
  const recipients = (Array.isArray(input.to) ? [...input.to] : [input.to])
    .map((r) => r.trim().toLowerCase())
    .sort()
    .join(",");
  return `${input.relatedType ?? "-"}:${input.relatedId ?? "-"}:${input.type}:${recipients}`;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "P2002";
}

export async function enqueueEmail(db: OutboxWriter, input: EnqueueInput): Promise<{ id: string }> {
  const dedupeKey = input.dedupeKey ?? computeDedupeKey(input);
  if (!input.force) {
    const existing = await db.emailOutbox.findFirst({ where: { dedupeKey } });
    if (existing) return { id: existing.id };
  }
  try {
    return await db.emailOutbox.create({
      data: {
        type: input.type,
        to: input.to,
        subject: input.subject ?? null,
        payload: input.payload,
        relatedType: input.relatedType ?? null,
        relatedId: input.relatedId ?? null,
        dedupeKey,
      },
    });
  } catch (e) {
    // Check-then-insert race: a concurrent enqueue won the unique index.
    // Return the winner's row — a duplicate enqueue must never fail the request.
    if (!input.force && isUniqueViolation(e)) {
      const existing = await db.emailOutbox.findFirst({ where: { dedupeKey } });
      if (existing) return { id: existing.id };
    }
    throw e;
  }
}

export type OutboxSender = (
  type: OutboxType,
  to: string | string[],
  payload: Record<string, unknown>,
  rowId: string
) => Promise<EmailResult>;

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
    findFirst(args: unknown): Promise<{ id: string } | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
    update(args: unknown): Promise<unknown>;
  };
};

const realDb = prisma as unknown as ProcessDb & OutboxWriter;

async function defaultSender(
  type: OutboxType,
  to: string | string[],
  payload: Record<string, unknown>,
  rowId: string
): Promise<EmailResult> {
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
  // rowId rides along as each provider call's idempotency key, so a retried
  // row can never double-send.
  const key = { idempotencyKey: rowId };
  switch (type) {
    case "booking_received":
      return sendBookingReceived(to as string, asParams(p.booking), key);
    case "admin_booking_alert":
      return sendAdminNewBookingAlert(to as string[], asParams(p.booking), key);
    case "booking_approved":
      return sendBookingApproved(to as string, asParams(p.booking), key);
    case "booking_rescheduled":
      return sendBookingRescheduled(to as string, asParams(p.booking), key);
    case "agent_rescheduled_notice":
      return sendAgentRescheduledNotice(to as string, asParams(p.params), key);
    case "booking_status":
      return sendBookingStatusEmail(to as string, p.booking as { name: string; ref: string }, p.status as "on_hold" | "under_review", key);
    case "interested_outcome":
      return sendInterestedOutcome(to as string, asParams(p.params), key);
    case "not_sold_followup": {
      const { sendEmail } = await import("./sendEmail");
      return sendEmail({ to, subject: asParams<string>(p.subject), html: asParams<string>(p.html), idempotencyKey: rowId });
    }
    case "agent_assignment":
      return sendAgentAssignment(to as string, asParams(p.params), key);
    case "agent_followup":
      return sendAgentFollowUp(to as string, asParams(p.params), key);
    case "transaction_confirmation":
      return sendTransactionConfirmation(to as string, asParams(p.params), key);
    case "receipt": {
      const { sendReceiptForOutbox } = await import("./receiptOutboxSender");
      return sendReceiptForOutbox(p.receiptId as string, rowId);
    }
    default:
      return { sent: false, error: `Unknown outbox type: ${type}` };
  }
}

export type SleepFn = (ms: number) => Promise<unknown>;

const defaultSleep: SleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function processOutbox(
  opts: { sender?: OutboxSender; now?: Date; batchSize?: number; db?: ProcessDb; ids?: string[]; sleep?: SleepFn } = {}
): Promise<{ sent: number; failed: number; deferred: number }> {
  const db = opts.db ?? realDb;
  const sender = opts.sender ?? defaultSender;
  const now = opts.now ?? new Date();
  const batchSize = opts.batchSize ?? BATCH_SIZE;
  const sleep = opts.sleep ?? defaultSleep;
  const result = { sent: 0, failed: 0, deferred: 0 };
  // Environment safety: never send outside production unless explicitly
  // allowed. A local dev server or script sharing the production DATABASE_URL
  // must not claim real rows and mark them SENT — it would black-hole
  // production mail (dev policy redirects it to a dead inbox). Refuse before
  // touching any row. Local email testing sets ALLOW_DEV_SEND=true.
  if (process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_SEND !== "true") {
    console.warn(
      "[email-safety] Refusing to send: not production and ALLOW_DEV_SEND is not true. No outbox rows touched."
    );
    return result;
  }
  const onlyIds = opts.ids && opts.ids.length > 0 ? [...new Set(opts.ids)] : null;

  if (!onlyIds) {
    // Reap rows orphaned by a dead worker before selecting work, so a crash
    // between claim and outcome can never wedge a row in SENDING forever.
    // (The inline ids path skips this: it only touches its own fresh rows.)
    await db.emailOutbox.updateMany({
      where: {
        status: "SENDING",
        updatedAt: { lt: new Date(now.getTime() - STALE_SENDING_MINUTES * 60_000) },
      },
      data: { status: "PENDING" },
    });
  }

  const due = await db.emailOutbox.findMany({
    where: {
      ...(onlyIds ? { id: { in: onlyIds } } : {}),
      status: "PENDING",
      nextAttemptAt: { lte: now },
      attempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  for (const row of due) {
    // Atomic claim (PENDING -> SENDING guarded on still-PENDING): a single
    // conditional update, so the inline send, the pinger, and the cron can
    // race on a row and exactly one of them sends it.
    const claimed = await db.emailOutbox.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: { status: "SENDING" },
    });
    if (claimed.count === 0) continue;
    // In-process retries: a transient SMTP stall fails fast and succeeds on
    // an immediate retry far more often than after minutes of backoff. The
    // terminal attempt (this run would reach MAX_ATTEMPTS) gets a single try
    // — backoff already gave it its chances; this run just records the verdict.
    const rapidRetries = row.attempts + 1 >= MAX_ATTEMPTS ? 0 : INLINE_RETRY_WAITS_MS.length;
    let outcome: EmailResult = { sent: false, error: "Outbox sender did not run" };
    for (let rapid = 0; ; rapid++) {
      try {
        outcome = await sender(
          row.type as OutboxType,
          row.to as string | string[],
          (row.payload ?? {}) as Record<string, unknown>,
          row.id
        );
      } catch (e) {
        outcome = { sent: false, error: e instanceof Error ? e.message : "Outbox sender threw" };
      }
      // Permanent verdicts (e.g. provider 4xx validation) never change on
      // retry — break immediately instead of burning in-process attempts.
      if (outcome.sent || outcome.permanent || rapid >= rapidRetries) break;
      await sleep(INLINE_RETRY_WAITS_MS[rapid]);
    }
    const attempts = row.attempts + 1;
    if (outcome.sent) {
      result.sent++;
      await db.emailOutbox.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          attempts,
          sentAt: now,
          lastError: null,
          provider: outcome.provider ?? null,
          providerMessageId: outcome.providerMessageId ?? null,
        },
      });
    } else if (outcome.permanent || attempts >= MAX_ATTEMPTS) {
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

// Inline send after the response. Call sites collect the outbox ids they just
// enqueued (inside the DB transaction where one exists) and call this ONLY
// after the transaction has committed. after() runs post-response: it never
// blocks or delays the request, and a failure here only defers rows to a
// later drain — it can never fail the request. Every call sends its own ids
// first, then drains older due rows (batch) so deferred mail from earlier
// requests is picked up by later traffic without any scheduler.
export function scheduleInlineOutboxSend(
  ids: string[],
  deps: {
    afterImpl?: (cb: () => void) => void;
    sendIds?: (ids: string[]) => Promise<{ sent: number; failed: number; deferred: number }>;
    drainAll?: () => Promise<{ sent: number; failed: number; deferred: number }>;
  } = {}
): void {
  if (ids.length === 0) return;
  const afterImpl = deps.afterImpl ?? after;
  const sendIds = deps.sendIds ?? ((runIds) => processOutbox({ ids: runIds }));
  const drainAll = deps.drainAll ?? (() => processOutbox());
  const unique = [...new Set(ids)];
  const logResult = (tag: string, r: { sent: number; failed: number; deferred: number }) => {
    if (r.sent + r.failed > 0) console.log(`[outbox] ${tag}: sent=${r.sent} failed=${r.failed} deferred=${r.deferred}`);
  };
  afterImpl(() => {
    sendIds(unique).then(
      (r) => {
        logResult("inline delivered", r);
        return drainAll();
      },
      (e) => {
        logServerError("inline outbox send failed", e);
        return drainAll();
      }
    ).then(
      (r) => logResult("inline drain delivered", r),
      (e) => logServerError("inline outbox drain failed", e)
    );
  });
}

// Drain hook for admin inbox loads: one background pass over due rows, at
// most once per 60s per server instance (module-level timestamp), so sidebar
// polling can't storm the mail provider. Keeps deferred mail moving while an
// admin is working, with zero scheduling infrastructure.
let lastInboxDrainAt = 0;
export function drainOutboxOnAdminInboxLoad(
  deps: { now?: number; afterImpl?: (cb: () => void) => void; drain?: () => Promise<unknown> } = {}
): void {
  const now = deps.now ?? Date.now();
  if (now - lastInboxDrainAt < 60_000) return;
  lastInboxDrainAt = now;
  const afterImpl = deps.afterImpl ?? after;
  const drain = deps.drain ?? (() => processOutbox());
  afterImpl(() => {
    drain().then(
      undefined,
      (e) => logServerError("inbox-load outbox drain failed", e)
    );
  });
}
