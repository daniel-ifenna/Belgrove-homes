import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  computeBackoffMinutes,
  computeDedupeKey,
  enqueueEmail,
  processOutbox,
  scheduleInlineOutboxSend,
  drainOutboxOnAdminInboxLoad,
  MAX_ATTEMPTS,
  STALE_SENDING_MINUTES,
  type ProcessDb,
  type OutboxWriter,
} from "../email/outbox";

// processOutbox refuses outside production unless explicitly allowed — the
// suite opts in so delivery behavior stays testable; the refusal itself is
// covered by dedicated tests below.
beforeEach(() => {
  vi.stubEnv("ALLOW_DEV_SEND", "true");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

// In-process retries wait 2s/5s for real — tests inject an instant sleep.
const noSleep = async () => undefined;

type Row = {
  id: string;
  type: string;
  to: unknown;
  payload: unknown;
  dedupeKey: string | null;
  attempts: number;
  status: string;
  nextAttemptAt: Date;
  updatedAt: Date;
  lastError: string | null;
  sentAt: Date | null;
};

type FindArgs = {
  where: {
    id?: { in?: string[] };
    status?: string | { in?: string[] };
    nextAttemptAt?: { lte?: Date };
    updatedAt?: { lt?: Date };
    attempts?: { lt?: number };
  };
};
type UpdateManyArgs = {
  where: { id?: string; status?: string | { in?: string[] }; updatedAt?: { lt?: Date } };
  data: Partial<Row>;
};
type UpdateArgs = { where: { id: string }; data: Partial<Row> };

function mockDb(initial: Partial<Row>[] = []) {
  const rows: Row[] = initial.map((r, i) => ({
    id: r.id ?? `o${i + 1}`,
    type: r.type ?? "booking_received",
    to: r.to ?? "a@x.com",
    payload: r.payload ?? {},
    attempts: r.attempts ?? 0,
    status: r.status ?? "PENDING",
    nextAttemptAt: r.nextAttemptAt ?? new Date(0),
    updatedAt: r.updatedAt ?? new Date(0),
    dedupeKey: r.dedupeKey ?? null,
    lastError: r.lastError ?? null,
    sentAt: r.sentAt ?? null,
  }));
  const db: ProcessDb & OutboxWriter = {
    emailOutbox: {
      findMany: async (args: FindArgs) => {
        const w = args.where;
        const st = w.status;
        return rows.filter(
          (r) =>
            (!w.id?.in || w.id.in.includes(r.id)) &&
            (!st || (typeof st === "string" ? r.status === st : st.in ? st.in.includes(r.status) : true)) &&
            (!w.nextAttemptAt?.lte || r.nextAttemptAt <= w.nextAttemptAt.lte) &&
            (!w.updatedAt?.lt || r.updatedAt < w.updatedAt.lt) &&
            (w.attempts?.lt === undefined || r.attempts < w.attempts.lt)
        );
      },
      findFirst: async (args: { where: { dedupeKey?: string } }) => {
        if (!args.where?.dedupeKey) return null;
        return rows.find((r) => r.dedupeKey === args.where.dedupeKey) ?? null;
      },
      create: async (args: { data: Record<string, unknown> }) => {
        // Faithful to the real unique index on dedupeKey: a duplicate
        // non-null key throws P2002 like Prisma does in production.
        const key = (args.data.dedupeKey as string | null) ?? null;
        if (key !== null && rows.some((r) => r.dedupeKey === key)) {
          throw Object.assign(new Error("Unique constraint failed on the fields: (`dedupeKey`)"), {
            code: "P2002",
          });
        }
        const row = {
          id: `o${rows.length + 1}`,
          type: (args.data.type as string) ?? "booking_received",
          to: args.data.to ?? "a@x.com",
          payload: args.data.payload ?? {},
          dedupeKey: (args.data.dedupeKey as string | null) ?? null,
          attempts: 0,
          status: "PENDING",
          nextAttemptAt: new Date(0),
          updatedAt: new Date(0),
          lastError: null,
          sentAt: null,
        };
        rows.push(row);
        return { id: row.id };
      },
      updateMany: async (args: UpdateManyArgs) => {
        let n = 0;
        for (const r of rows) {
          if (args.where.id && r.id !== args.where.id) continue;
          const st = args.where.status;
          if (typeof st === "string" ? r.status !== st : st?.in && !st.in.includes(r.status)) continue;
          if (args.where.updatedAt?.lt && !(r.updatedAt < args.where.updatedAt.lt)) continue;
          Object.assign(r, args.data);
          n++;
        }
        return { count: n };
      },
      update: async (args: UpdateArgs) => {
        const r = rows.find((x) => x.id === args.where.id)!;
        Object.assign(r, args.data);
        return r;
      },
    },
  };
  return { db, rows };
}

describe("outbox backoff", () => {
  it("waits 0.5/2/8/32/128 minutes between attempts (fast first retry)", () => {
    expect([1, 2, 3, 4, 5].map(computeBackoffMinutes)).toEqual([0.5, 2, 8, 32, 128]);
    expect(computeBackoffMinutes(0)).toBe(0.5);
    expect(computeBackoffMinutes(99)).toBe(128);
  });
});

describe("processOutbox", () => {
  it("sends due mail and marks SENT", async () => {
    const { db, rows } = mockDb([{}]);
    const res = await processOutbox({
      db,
      now: new Date("2026-09-28T12:00:00Z"),
      sender: async () => ({ sent: true, error: null }),
    });
    expect(res).toEqual({ sent: 1, failed: 0, deferred: 0 });
    expect(rows[0].status).toBe("SENT");
    expect(rows[0].attempts).toBe(1);
    expect(rows[0].sentAt).not.toBe(null);
  });

  it("provider failure retries with backoff, then marks FAILED after 5 attempts", async () => {
    const { db, rows } = mockDb([{}]);
    const sender = async () => ({ sent: false as const, error: "SMTP down" });
    let now = new Date("2026-09-28T12:00:00Z");
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const res = await processOutbox({ db, now, sender, sleep: noSleep });
      if (attempt < MAX_ATTEMPTS) {
        expect(res.deferred).toBe(1);
        expect(rows[0].status).toBe("PENDING");
        // Not due before the backoff elapses (first backoff is 30s).
        const early = await processOutbox({ db, now: new Date(now.getTime() + 10_000), sender, sleep: noSleep });
        expect(early).toEqual({ sent: 0, failed: 0, deferred: 0 });
        now = new Date(rows[0].nextAttemptAt);
      } else {
        expect(res.failed).toBe(1);
        expect(rows[0].status).toBe("FAILED");
        expect(rows[0].attempts).toBe(MAX_ATTEMPTS);
        expect(rows[0].lastError).toContain("SMTP down");
      }
    }
    // FAILED rows are never retried.
    const after = await processOutbox({ db, now: new Date("2027-01-01T00:00:00Z"), sender, sleep: noSleep });
    expect(after).toEqual({ sent: 0, failed: 0, deferred: 0 });
  });

  it("recovers a SENDING row orphaned by a dead worker (stale claim is retried)", async () => {
    expect(STALE_SENDING_MINUTES).toBeGreaterThan(0);
    // Claimed an hour ago, worker died before writing the outcome.
    const { db, rows } = mockDb([
      { status: "SENDING", attempts: 0, updatedAt: new Date("2026-09-28T11:00:00Z") },
    ]);
    const res = await processOutbox({
      db,
      now: new Date("2026-09-28T12:00:00Z"),
      sender: async () => ({ sent: true, error: null }),
    });
    expect(res).toEqual({ sent: 1, failed: 0, deferred: 0 });
    expect(rows[0].status).toBe("SENT");
  });

  it("leaves a freshly claimed SENDING row alone (another worker may own it)", async () => {
    const claimedAt = new Date("2026-09-28T11:58:00Z");
    const { db, rows } = mockDb([{ status: "SENDING", attempts: 0, updatedAt: claimedAt }]);
    let sends = 0;
    const res = await processOutbox({
      db,
      now: new Date("2026-09-28T12:00:00Z"),
      sender: async () => {
        sends++;
        return { sent: true, error: null };
      },
    });
    // Selection is PENDING-only and the reaper only resets stale claims, so
    // a row claimed 5 minutes ago is neither reset nor sent here.
    expect(sends).toBe(0);
    expect(res).toEqual({ sent: 0, failed: 0, deferred: 0 });
    expect(rows[0].status).toBe("SENDING");
    expect(rows[0].attempts).toBe(0);
  });

  it("passes the row id as the sender's 4th arg (provider idempotency key)", async () => {
    const { db } = mockDb([{ id: "row-9" }]);
    const seen: unknown[][] = [];
    await processOutbox({
      db,
      now: new Date("2026-09-28T12:00:00Z"),
      sender: async (...args: unknown[]) => {
        seen.push(args);
        return { sent: true, error: null };
      },
    });
    expect(seen).toHaveLength(1);
    expect(seen[0][3]).toBe("row-9");
  });

  it("a permanent failure fails the row immediately instead of deferring", async () => {
    const { db, rows } = mockDb([{}]);
    let calls = 0;
    const res = await processOutbox({
      db,
      now: new Date("2026-09-28T12:00:00Z"),
      sleep: noSleep,
      sender: async () => {
        calls++;
        return { sent: false as const, error: "Resend error 422: invalid from", permanent: true };
      },
    });
    // No in-process retries for a verdict that will never change.
    expect(calls).toBe(1);
    expect(res).toEqual({ sent: 0, failed: 1, deferred: 0 });
    expect(rows[0].status).toBe("FAILED");
    expect(rows[0].attempts).toBe(1);
    expect(rows[0].lastError).toContain("422");
  });

  it("a throwing sender is treated as a failed attempt, not a crash", async () => {
    const { db, rows } = mockDb([{}]);
    const res = await processOutbox({
      db,
      now: new Date(),
      sleep: noSleep,
      sender: async () => {
        throw new Error("transport exploded");
      },
    });
    expect(res.deferred).toBe(1);
    expect(rows[0].lastError).toContain("transport exploded");
  });

  it("enqueue writes a PENDING row without sending (submission survives provider outage)", async () => {
    const created: unknown[] = [];
    const db = {
      emailOutbox: {
        findFirst: async () => null,
        create: async (args: unknown) => {
          created.push(args);
          return { id: "o1" };
        },
      },
    };
    const out = await enqueueEmail(db, {
      type: "booking_received",
      to: "client@x.com",
      payload: { to: "client@x.com", booking: { ref: "BKG-1" } },
      relatedType: "booking",
      relatedId: "b1",
    });
    expect(out.id).toBe("o1");
    expect(created).toHaveLength(1);
    // No send attempted at enqueue time — even with the provider down, the
    // caller already has its 201 and the mail is durable.
  });
});

describe("processOutbox ids filter", () => {
  it("only processes the given ids, leaving other due rows for a later drain", async () => {
    const { db, rows } = mockDb([{ id: "mine" }, { id: "older" }]);
    const res = await processOutbox({
      db,
      now: new Date("2026-09-28T12:00:00Z"),
      ids: ["mine"],
      sender: async () => ({ sent: true, error: null }),
    });
    expect(res).toEqual({ sent: 1, failed: 0, deferred: 0 });
    expect(rows.find((r) => r.id === "mine")!.status).toBe("SENT");
    expect(rows.find((r) => r.id === "older")!.status).toBe("PENDING");
  });

  it("two concurrent runs racing on the same row send it exactly once", async () => {
    const { db, rows } = mockDb([{ id: "race" }]);
    let sends = 0;
    const sender = async () => {
      sends++;
      await new Promise((r) => setTimeout(r, 5));
      return { sent: true as const, error: null };
    };
    const opts = { db, now: new Date("2026-09-28T12:00:00Z"), ids: ["race"], sender };
    // The claim is a single conditional update (compare-and-swap): whichever
    // run claims first sends; the loser sees count 0 and skips.
    const [a, b] = await Promise.all([processOutbox(opts), processOutbox(opts)]);
    expect(sends).toBe(1);
    expect(a.sent + b.sent).toBe(1);
    expect(rows[0].status).toBe("SENT");
  });
});

describe("in-process retries", () => {
  it("succeeds on the 2nd attempt without deferring", async () => {
    const { db, rows } = mockDb([{}]);
    let calls = 0;
    const res = await processOutbox({
      db,
      now: new Date("2026-09-28T12:00:00Z"),
      sleep: noSleep,
      sender: async () => (++calls === 1 ? { sent: false as const, error: "stall" } : { sent: true as const, error: null }),
    });
    expect(calls).toBe(2);
    expect(res).toEqual({ sent: 1, failed: 0, deferred: 0 });
    expect(rows[0].status).toBe("SENT");
    expect(rows[0].attempts).toBe(1);
  });

  it("gives up after the 3rd attempt: PENDING, attempts+1, error and next attempt set", async () => {
    const now = new Date("2026-09-28T12:00:00Z");
    const { db, rows } = mockDb([{}]);
    let calls = 0;
    const res = await processOutbox({
      db,
      now,
      sleep: noSleep,
      sender: async () => {
        calls++;
        return { sent: false as const, error: "SMTP down" };
      },
    });
    expect(calls).toBe(3);
    expect(res).toEqual({ sent: 0, failed: 0, deferred: 1 });
    expect(rows[0].status).toBe("PENDING");
    expect(rows[0].attempts).toBe(1);
    expect(rows[0].lastError).toContain("SMTP down");
    expect(rows[0].nextAttemptAt.getTime()).toBeGreaterThan(now.getTime());
  });

  it("the terminal attempt gets a single try, then FAILED", async () => {
    const { db, rows } = mockDb([{ attempts: MAX_ATTEMPTS - 1 }]);
    let calls = 0;
    const res = await processOutbox({
      db,
      now: new Date("2026-09-28T12:00:00Z"),
      sleep: noSleep,
      sender: async () => {
        calls++;
        return { sent: false as const, error: "down" };
      },
    });
    expect(calls).toBe(1);
    expect(res.failed).toBe(1);
    expect(rows[0].status).toBe("FAILED");
  });
});

describe("dedupe", () => {
  it("computeDedupeKey normalizes recipient order and case", () => {
    const a = computeDedupeKey({ type: "admin_booking_alert", to: ["B@x.com", "a@x.com"], relatedType: "booking", relatedId: "b1" });
    const b = computeDedupeKey({ type: "admin_booking_alert", to: ["a@x.com", "b@x.com"], relatedType: "booking", relatedId: "b1" });
    expect(a).toBe(b);
    expect(a).toBe("booking:b1:admin_booking_alert:a@x.com,b@x.com");
  });

  it("enqueueing the same key twice creates one row and returns its id", async () => {
    const { db, rows } = mockDb([]);
    const input = {
      type: "booking_received" as const,
      to: "client@x.com",
      payload: {},
      relatedType: "booking",
      relatedId: "b1",
    };
    const first = await enqueueEmail(db, input);
    const second = await enqueueEmail(db, input);
    expect(second.id).toBe(first.id);
    expect(rows).toHaveLength(1);
  });

  it("force bypasses dedupe (explicit resend always sends)", async () => {
    const { db, rows } = mockDb([]);
    const input = {
      type: "receipt" as const,
      to: "client@x.com",
      payload: {},
      relatedType: "receipt",
      relatedId: "r1",
      force: true,
    };
    await enqueueEmail(db, input);
    await enqueueEmail(db, input);
    expect(rows).toHaveLength(2);
  });

  it("force resend succeeds while a FAILED row holds the base key (no P2002)", async () => {
    // Regression: the old row is never deleted, so its dedupeKey is still
    // taken — a plain-key force insert P2002-failed the resend request
    // ("Couldn't queue the resend") instead of sending.
    const { db, rows } = mockDb([
      {
        id: "old",
        type: "receipt",
        to: "client@x.com",
        status: "FAILED",
        attempts: 5,
        dedupeKey: "receipt:r1:receipt:client@x.com",
      },
    ]);
    const out = await enqueueEmail(db, {
      type: "receipt" as const,
      to: "client@x.com",
      payload: { receiptId: "r1" },
      relatedType: "receipt",
      relatedId: "r1",
      force: true,
    });
    expect(out.id).not.toBe("old");
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === "old")!.status).toBe("FAILED");
    expect(rows.find((r) => r.id === out.id)!.status).toBe("PENDING");
  });

  it("a P2002 race on insert returns the winner instead of failing", async () => {
    const { db } = mockDb([{ id: "winner", dedupeKey: "booking:b9:booking_received:c@x.com" }]);
    const realDb = db;
    const racingDb = {
      emailOutbox: {
        ...realDb.emailOutbox,
        create: async () => {
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        },
      },
    };
    const out = await enqueueEmail(racingDb, {
      type: "booking_received",
      to: "c@x.com",
      payload: {},
      relatedType: "booking",
      relatedId: "b9",
    });
    expect(out.id).toBe("winner");
  });
});

describe("inline mode", () => {
  it("makes a single attempt per row, no in-process retries", async () => {
    const { db, rows } = mockDb([{ id: "o1" }]);
    let calls = 0;
    const res = await processOutbox({
      db,
      now: new Date("2026-09-28T12:00:00Z"),
      ids: ["o1"],
      mode: "inline",
      sleep: noSleep,
      sender: async () => {
        calls++;
        return { sent: false as const, error: "stall" };
      },
    });
    expect(calls).toBe(1);
    expect(res).toEqual({ sent: 0, failed: 0, deferred: 1 });
    expect(rows[0].attempts).toBe(1);
  });

  it("stops starting new rows once the 20s budget has elapsed", async () => {
    const { db, rows } = mockDb([{ id: "o1" }, { id: "o2" }]);
    let calls = 0;
    const res = await processOutbox({
      db,
      now: new Date("2026-09-28T12:00:00Z"),
      // Invocation started 21s ago: budget already spent.
      startTime: Date.now() - 21_000,
      sender: async () => {
        calls++;
        return { sent: true, error: null };
      },
    });
    expect(calls).toBe(0);
    expect(res).toEqual({ sent: 0, failed: 0, deferred: 0 });
    expect(rows.every((r) => r.status === "PENDING" && r.attempts === 0)).toBe(true);
  });

  it("sends an id set with up to 2 concurrent workers, nothing twice", async () => {
    const { db, rows } = mockDb([{ id: "o1" }, { id: "o2" }, { id: "o3" }]);
    let live = 0;
    let maxLive = 0;
    const res = await processOutbox({
      db,
      now: new Date("2026-09-28T12:00:00Z"),
      ids: ["o1", "o2", "o3"],
      sender: async () => {
        live++;
        maxLive = Math.max(maxLive, live);
        await new Promise((r) => setTimeout(r, 5));
        live--;
        return { sent: true, error: null };
      },
    });
    expect(res).toEqual({ sent: 3, failed: 0, deferred: 0 });
    expect(maxLive).toBe(2);
    expect(rows.every((r) => r.status === "SENT" && r.attempts === 1)).toBe(true);
  });
});

describe("death trail and reaper", () => {
  it("reaper keeps the death lastError and adds its timestamp", async () => {
    const future = new Date("2027-01-01T00:00:00Z");
    const { db, rows } = mockDb([
      {
        id: "o1",
        status: "SENDING",
        attempts: 2,
        updatedAt: new Date("2026-09-28T11:00:00Z"),
        nextAttemptAt: future,
        lastError: "sending started, no outcome recorded",
      },
    ]);
    let sends = 0;
    const res = await processOutbox({
      db,
      now: new Date("2026-09-28T12:00:00Z"),
      sender: async () => {
        sends++;
        return { sent: true, error: null };
      },
    });
    // Not due (nextAttemptAt in the future) so it is only reaped, not sent.
    expect(sends).toBe(0);
    expect(res).toEqual({ sent: 0, failed: 0, deferred: 0 });
    expect(rows[0].status).toBe("PENDING");
    expect(rows[0].attempts).toBe(2);
    expect(rows[0].lastError).toContain("reaped 2026-09-28T12:00:00.000Z");
    expect(rows[0].lastError).toContain("sending started, no outcome recorded");
  });

  it("a killed send leaves attempts+1 and the trail (reaper input)", async () => {
    const { db, rows } = mockDb([{}]);
    // Simulate death between claim and outcome: claim, write trail, no outcome.
    const due = await db.emailOutbox.findMany({ where: { status: "PENDING" } });
    expect(due).toHaveLength(1);
    await db.emailOutbox.updateMany({ where: { id: "o1", status: "PENDING" }, data: { status: "SENDING" } });
    await db.emailOutbox.update({ where: { id: "o1" }, data: { attempts: 1, lastError: "sending started, no outcome recorded" } });
    expect(rows[0].status).toBe("SENDING");
    expect(rows[0].attempts).toBe(1);
    expect(rows[0].lastError).toBe("sending started, no outcome recorded");
  });
});

describe("scheduleInlineOutboxSend", () => {
  it("sends its ids first, then drains older due rows — never blocking", async () => {
    const calls: unknown[] = [];
    let captured: (() => void) | null = null;
    scheduleInlineOutboxSend(["a", "a", "b"], {
      afterImpl: (cb) => {
        captured = cb;
      },
      sendIds: async (ids) => {
        calls.push({ first: ids });
        return { sent: 1, failed: 0, deferred: 0 };
      },
      drainAll: async () => {
        calls.push({ drain: true });
        return { sent: 0, failed: 0, deferred: 0 };
      },
    });
    expect(captured).not.toBe(null);
    expect(calls).toHaveLength(0); // deferred: nothing sent synchronously
    captured!();
    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toEqual([{ first: ["a", "b"] }, { drain: true }]);
  });

  it("still drains when the ids send throws, and swallows drain errors", async () => {
    let drained = false;
    let captured: (() => void) | null = null;
    scheduleInlineOutboxSend(["a"], {
      afterImpl: (cb) => {
        captured = cb;
      },
      sendIds: async () => {
        throw new Error("boom");
      },
      drainAll: async () => {
        drained = true;
        throw new Error("drain boom");
      },
    });
    expect(() => captured!()).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
    expect(drained).toBe(true);
  });

  it("schedules nothing when there are no ids", async () => {
    let called = false;
    scheduleInlineOutboxSend([], {
      afterImpl: () => {
        called = true;
      },
    });
    expect(called).toBe(false);
  });
});

describe("environment safety", () => {
  it("refuses outside production without ALLOW_DEV_SEND: no rows touched, one warning", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_DEV_SEND", "");
    const { db, rows } = mockDb([{}]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const res = await processOutbox({ db, now: new Date("2026-09-28T12:00:00Z"), sender: async () => ({ sent: true, error: null }) });
      expect(res).toEqual({ sent: 0, failed: 0, deferred: 0 });
      expect(rows[0].status).toBe("PENDING");
      expect(rows[0].attempts).toBe(0);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain("ALLOW_DEV_SEND");
    } finally {
      warn.mockRestore();
    }
  });

  it("sends when ALLOW_DEV_SEND=true is set explicitly", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ALLOW_DEV_SEND", "true");
    const { db, rows } = mockDb([{}]);
    const res = await processOutbox({ db, now: new Date("2026-09-28T12:00:00Z"), sender: async () => ({ sent: true, error: null }) });
    expect(res.sent).toBe(1);
    expect(rows[0].status).toBe("SENT");
  });
});

describe("proof of sending", () => {
  it("persists provider and providerMessageId on SENT", async () => {
    const { db, rows } = mockDb([{}]);
    await processOutbox({
      db,
      now: new Date("2026-09-28T12:00:00Z"),
      sender: async () => ({ sent: true, error: null, provider: "resend" as const, providerMessageId: "email-abc" }),
    });
    expect(rows[0].status).toBe("SENT");
    expect((rows[0] as Record<string, unknown>).provider).toBe("resend");
    expect((rows[0] as Record<string, unknown>).providerMessageId).toBe("email-abc");
  });
});

describe("drainOutboxOnAdminInboxLoad", () => {
  it("drains at most once per 60s per server instance", async () => {
    let drains = 0;
    const deps = (now: number) => ({
      now,
      afterImpl: (cb: () => void) => cb(),
      drain: async () => {
        drains++;
      },
    });
    const t0 = 1_000_000;
    drainOutboxOnAdminInboxLoad(deps(t0));
    // afterImpl runs the callback synchronously here; the drain itself is async.
    await new Promise((r) => setTimeout(r, 5));
    expect(drains).toBe(1);
    drainOutboxOnAdminInboxLoad(deps(t0 + 59_999));
    await new Promise((r) => setTimeout(r, 5));
    expect(drains).toBe(1);
    drainOutboxOnAdminInboxLoad(deps(t0 + 60_000));
    await new Promise((r) => setTimeout(r, 5));
    expect(drains).toBe(2);
  });
});
