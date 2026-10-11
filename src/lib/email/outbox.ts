import { after } from "next/server";
import { randomUUID } from "node:crypto";
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
  // Priority override. Defaults via priorityForType below (receipts and
  // payment confirmations first). Higher sends first.
  priority?: number;
};

export type PendingOutboxFinder = {
  emailOutbox: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
  };
};

export type OutboxWriter = {
  emailOutbox: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
  };
};

// Cooldown for repeat resends: if a receipt already has a queued or
// in-flight outbox row, reuse it instead of piling on another one.
// Impatient double-clicks (the source of 15-attempt pile-ups) collapse to
// the single in-flight send; a genuinely new resend is still possible once
// nothing is pending. Reusing a SENDING row is safe: processRow only
// proceeds on an atomic PENDING→SENDING claim, so a live send is never
// doubled — and a dead worker's row is reaped back to PENDING anyway.
export async function findPendingReceiptOutboxRow(
  db: PendingOutboxFinder,
  receiptId: string
): Promise<{ id: string } | null> {
  return db.emailOutbox.findFirst({
    where: { type: "receipt", relatedId: receiptId, status: { in: ["PENDING", "SENDING"] } },
  });
}

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

// Priority: receipts and payment confirmations jump the queue ahead of
// reminders and bulk mail. Stored on the row so ordering survives restarts.
export const PRIORITY_URGENT = 10;
export const PRIORITY_NORMAL = 0;
export function priorityForType(type: OutboxType): number {
  return type === "receipt" || type === "transaction_confirmation" ? PRIORITY_URGENT : PRIORITY_NORMAL;
}

// Exponential backoff with jitter: base minutes from the table, ±20%
// random spread so a fleet of deferred rows never thundering-herds the
// provider on the same second. Pure except Math.random.
export function computeNextAttemptAt(now: Date, attempts: number): Date {
  const base = computeBackoffMinutes(attempts);
  const jitter = base * (0.8 + Math.random() * 0.4);
  return new Date(now.getTime() + jitter * 60_000);
}

// Permanent failures never succeed on retry: missing files (legacy ENOENT
// from the old disk cache), invalid recipients, and provider 4xx
// validation. The outbox fails these fast instead of burning 5 attempts.
export function isPermanentSendError(message: string | null | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  if (m.includes("enoent") || m.includes("no such file")) return true;
  if (m.includes("invalid recipient") || m.includes("no recipients")) return true;
  // Provider 4xx validation never succeeds on retry — except 429 (rate
  // limit) and 408 (timeout), which are transient by definition. A bare
  // "resend error 4" prefix match would wrongly fail 429s fast.
  const code = m.match(/resend error (\d{3})/)?.[1];
  if (code) {
    const n = Number(code);
    if (n === 429 || n === 408) return false;
    return n >= 400 && n < 500;
  }
  return false;
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
  const baseKey = input.dedupeKey ?? computeDedupeKey(input);
  // Explicit user actions (e.g. receipt resend) always create a fresh row.
  // The suffixed key keeps the unique index from collapsing the resend into
  // the pre-existing row (which may still be sitting there as SENT/FAILED)
  // and P2002-failing the request — the exact "Couldn't queue the resend"
  // failure. Non-force enqueues keep the plain key so repeats collapse.
  const dedupeKey = input.force ? `${baseKey}:resend:${randomUUID()}` : baseKey;
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
        priority: input.priority ?? priorityForType(input.type),
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
  lastError: string | null;
  priority?: number;
  createdAt?: Date;
  startedAt?: Date | null;
  sentAt?: Date | null;
};

// Hard cap for starting new sends in one invocation: never start a send
// that could outlive maxDuration. Rows not started stay PENDING for the
// next drain.
export const SEND_BUDGET_MS = 20_000;
// Max concurrent sends when delivering an explicit id set: one slow send
// must not starve the others. Claims stay per-row atomic, so concurrent
// workers can never double-send.
export const IDS_CONCURRENCY = 2;

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
      // Explicit "Regenerate & resend" rides the payload; ordinary sends
      // reuse the stored bytes and never rebuild the PDF.
      const regen = (p as { regen?: unknown }).regen === true;
      return sendReceiptForOutbox(p.receiptId as string, rowId, regen ? { regen: true } : undefined);
    }
    default:
      return { sent: false, error: `Unknown outbox type: ${type}` };
  }
}

export type SleepFn = (ms: number) => Promise<unknown>;

const defaultSleep: SleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export type OutboxMode = "inline" | "drain";

export async function processOutbox(
  opts: {
    sender?: OutboxSender;
    now?: Date;
    batchSize?: number;
    db?: ProcessDb;
    ids?: string[];
    sleep?: SleepFn;
    // "inline": rows sent right after a request — a single attempt per row,
    // no in-process retries. "drain" (default): retries stay here.
    mode?: OutboxMode;
    // Invocation start (ms epoch) for the send budget; injectable in tests.
    startTime?: number;
  } = {}
): Promise<{ sent: number; failed: number; deferred: number }> {
  const db = opts.db ?? realDb;
  const sender = opts.sender ?? defaultSender;
  const now = opts.now ?? new Date();
  const batchSize = opts.batchSize ?? BATCH_SIZE;
  const sleep = opts.sleep ?? defaultSleep;
  const mode = opts.mode ?? "drain";
  const startTime = opts.startTime ?? Date.now();
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
    // The previous lastError (usually the "sending started" death trail) is
    // kept and timestamped, so a killed function always leaves evidence in
    // the row and in the admin Stuck emails view.
    // (The inline ids path skips this: it only touches its own fresh rows.)
    const stale = await db.emailOutbox.findMany({
      where: {
        status: "SENDING",
        updatedAt: { lt: new Date(now.getTime() - STALE_SENDING_MINUTES * 60_000) },
      },
    });
    for (const s of stale) {
      await db.emailOutbox.updateMany({
        where: { id: s.id, status: "SENDING" },
        data: {
          status: "PENDING",
          lastError: `reaped ${now.toISOString()}: ${s.lastError ?? "no outcome recorded"}`.slice(0, 1000),
        },
      });
    }
  }

  // Priority first (receipts 10 before bulk 0), then oldest first. The
  // (status, nextAttemptAt) index serves this scan; claims below use
  // SELECT … FOR UPDATE SKIP LOCKED on the real DB so concurrent workers
  // never block each other.
  let due: OutboxRow[];
  const rawDb = db as unknown as { $queryRaw?: unknown };
  if (!onlyIds && typeof rawDb.$queryRaw === "function") {
    try {
      const ids = (await (prisma.$queryRaw as unknown as (q: TemplateStringsArray, ...v: unknown[]) => Promise<{ id: string }[]>)
        `SELECT id FROM "EmailOutbox" WHERE status = 'PENDING' AND "nextAttemptAt" <= ${now} AND attempts < ${MAX_ATTEMPTS} ORDER BY priority DESC, "createdAt" ASC LIMIT ${batchSize} FOR UPDATE SKIP LOCKED`) as { id: string }[];
      const idSet = new Set(ids.map((r) => r.id));
      const fetched = await db.emailOutbox.findMany({
        where: { id: { in: [...idSet] }, status: "PENDING", nextAttemptAt: { lte: now }, attempts: { lt: MAX_ATTEMPTS } },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        take: batchSize,
      });
      due = fetched.sort((a, b) => {
        const pa = (a as unknown as { priority?: number }).priority ?? 0;
        const pb = (b as unknown as { priority?: number }).priority ?? 0;
        return pb - pa;
      });
    } catch {
      due = await db.emailOutbox.findMany({
        where: {
          status: "PENDING",
          nextAttemptAt: { lte: now },
          attempts: { lt: MAX_ATTEMPTS },
        },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        take: batchSize,
      });
    }
  } else {
    due = await db.emailOutbox.findMany({
      where: {
        ...(onlyIds ? { id: { in: onlyIds } } : {}),
        status: "PENDING",
        nextAttemptAt: { lte: now },
        attempts: { lt: MAX_ATTEMPTS },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: batchSize,
    });
  }

  async function processRow(row: OutboxRow): Promise<void> {
    // Atomic claim (PENDING -> SENDING guarded on still-PENDING): a single
    // conditional update, so concurrent workers racing on a row send it
    // exactly once — only the claim winner proceeds past this point.
    const claimed = await db.emailOutbox.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: { status: "SENDING" },
    });
    if (claimed.count === 0) return;
    const attempts = row.attempts + 1;
    // startedAt is set once (first send start) and never overwritten, so
    // queue wait (startedAt - createdAt) and send duration (sentAt -
    // startedAt) stay truthful across retries.
    try {
      await db.emailOutbox.updateMany({
        where: { id: row.id, startedAt: null },
        data: { startedAt: now },
      });
    } catch (e) {
      logServerError(`outbox ${row.id}: failed to write startedAt`, e);
    }
    // Trail on death: attempts increment and lastError are written NOW, so a
    // function killed mid-send (past maxDuration, frozen worker) still leaves
    // evidence. Cleared on success, overwritten by the real error on failure.
    try {
      await db.emailOutbox.update({
        where: { id: row.id },
        data: { attempts, lastError: "sending started, no outcome recorded" },
      });
    } catch (e) {
      logServerError(`outbox ${row.id}: failed to write send trail`, e);
    }
    // Retries live in drain mode only. Inline mode gets exactly one attempt:
    // it must finish fast inside the request's lifetime; anything unsent is
    // picked up by a later drain with the full retry treatment. The terminal
    // attempt (this run would reach MAX_ATTEMPTS) also gets a single try.
    const rapidRetries =
      mode === "inline" || row.attempts + 1 >= MAX_ATTEMPTS ? 0 : INLINE_RETRY_WAITS_MS.length;
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
    const permanent = outcome.permanent || isPermanentSendError(outcome.error);
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
    } else if (permanent || attempts >= MAX_ATTEMPTS) {
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
          nextAttemptAt: computeNextAttemptAt(now, attempts),
          lastError: (outcome.error ?? "failed").slice(0, 1000),
        },
      });
    }
  }

  // Time budget: never START a send once SEND_BUDGET_MS has elapsed in this
  // invocation — it could outlive maxDuration and die mid-row. Rows not
  // started stay PENDING for the next drain.
  if (onlyIds) {
    // Inline delivery: up to IDS_CONCURRENCY rows at once so one slow send
    // cannot starve the others sharing the same request.
    const queue = [...due];
    const workers = Array.from({ length: Math.min(IDS_CONCURRENCY, queue.length) }, async () => {
      for (;;) {
        if (Date.now() - startTime > SEND_BUDGET_MS) return;
        const row = queue.shift();
        if (!row) return;
        await processRow(row);
      }
    });
    await Promise.all(workers);
  } else {
    for (const row of due) {
      if (Date.now() - startTime > SEND_BUDGET_MS) break;
      await processRow(row);
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
  const sendIds = deps.sendIds ?? ((runIds) => processOutbox({ ids: runIds, mode: "inline" }));
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
