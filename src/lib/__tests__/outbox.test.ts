import { describe, it, expect } from "vitest";
import {
  computeBackoffMinutes,
  enqueueEmail,
  processOutbox,
  MAX_ATTEMPTS,
  type ProcessDb,
} from "../email/outbox";

type Row = {
  id: string;
  type: string;
  to: unknown;
  payload: unknown;
  attempts: number;
  status: string;
  nextAttemptAt: Date;
  lastError: string | null;
  sentAt: Date | null;
};

type FindArgs = {
  where: {
    status?: string | { in?: string[] };
    nextAttemptAt?: { lte?: Date };
    attempts?: { lt?: number };
  };
};
type UpdateManyArgs = { where: { id?: string; status?: { in?: string[] } }; data: Partial<Row> };
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
    lastError: r.lastError ?? null,
    sentAt: r.sentAt ?? null,
  }));
  const db: ProcessDb = {
    emailOutbox: {
      findMany: async (args: FindArgs) => {
        const w = args.where;
        const st = w.status;
        return rows.filter(
          (r) =>
            (!st || (typeof st === "string" ? r.status === st : st.in ? st.in.includes(r.status) : true)) &&
            (!w.nextAttemptAt?.lte || r.nextAttemptAt <= w.nextAttemptAt.lte) &&
            (w.attempts?.lt === undefined || r.attempts < w.attempts.lt)
        );
      },
      updateMany: async (args: UpdateManyArgs) => {
        let n = 0;
        for (const r of rows) {
          if (args.where.id && r.id !== args.where.id) continue;
          if (args.where.status?.in && !args.where.status.in.includes(r.status)) continue;
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
  it("waits 2/4/8/16/32 minutes between attempts", () => {
    expect([1, 2, 3, 4, 5].map(computeBackoffMinutes)).toEqual([2, 4, 8, 16, 32]);
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
      const res = await processOutbox({ db, now, sender });
      if (attempt < MAX_ATTEMPTS) {
        expect(res.deferred).toBe(1);
        expect(rows[0].status).toBe("PENDING");
        // Not due before the backoff elapses.
        const early = await processOutbox({ db, now: new Date(now.getTime() + 60_000), sender });
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
    const after = await processOutbox({ db, now: new Date("2027-01-01T00:00:00Z"), sender });
    expect(after).toEqual({ sent: 0, failed: 0, deferred: 0 });
  });

  it("a throwing sender is treated as a failed attempt, not a crash", async () => {
    const { db, rows } = mockDb([{}]);
    const res = await processOutbox({
      db,
      now: new Date(),
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
