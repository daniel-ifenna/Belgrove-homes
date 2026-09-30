import { describe, it, expect, vi, beforeEach } from "vitest";

// Inline-send ordering for POST /api/bookings: outbox ids must be collected
// inside the DB transaction, and the after() send scheduled only AFTER the
// transaction commits — scheduling inside would send before the rows exist
// and silently defer the mail to retry.

const events: string[] = [];
const outboxRows: { id: string; data: Record<string, unknown> }[] = [];
let scheduledIds: string[][] = [];

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ ok: true }),
  clientIp: () => "127.0.0.1",
  rateLimitResponse: () => new Response("limited", { status: 429 }),
}));

vi.mock("@/lib/prisma", () => {
  const createdBooking = {
    id: "bk-1",
    ref: "BKG-2026-00001",
    name: "Test Buyer",
    email: "buyer@example.com",
    phone: "+2348012345678",
    preferredDate: new Date("2026-12-15T09:00:00Z"),
    preferredTime: "10:00 AM",
    location: "Kado",
    agentName: null,
  };
  const txEmailOutbox = {
    findFirst: async () => null,
    create: async (args: { data: Record<string, unknown> }) => {
      const row = { id: `out-${outboxRows.length + 1}`, data: args.data };
      outboxRows.push(row);
      return { id: row.id };
    },
  };
  const tx = {
    inspectionBooking: { create: async () => ({ ...createdBooking }) },
    notification: { createMany: async () => ({ count: 1 }) },
    emailOutbox: txEmailOutbox,
  };
  return {
    prisma: {
      inspectionBooking: {
        findFirst: async () => null,
        findUnique: async () => null,
        create: async () => ({ ...createdBooking }),
      },
      notification: { createMany: async () => ({ count: 1 }) },
      user: {
        findMany: async () => [{ id: "u1", email: "staff@example.com" }],
      },
      customer: {
        findFirst: async () => null,
        create: async () => ({ id: "c1" }),
        update: async () => ({}),
      },
      $transaction: async (cb: (tx: unknown) => Promise<unknown>) => {
        const result = await cb(tx);
        events.push("committed");
        return result;
      },
    },
  };
});

vi.mock("@/lib/email/outbox", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/email/outbox")>();
  return {
    ...original,
    scheduleInlineOutboxSend: (ids: string[]) => {
      events.push("scheduled");
      scheduledIds.push(ids);
    },
  };
});

import { NextRequest } from "next/server";
import { POST } from "@/app/api/bookings/route";

function bookingRequest() {
  return new NextRequest("http://localhost/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Buyer",
      email: "buyer@example.com",
      phone: "+2348012345678",
      preferredDate: "2026-12-15",
      preferredTime: "10:00 AM",
      location: "Kado",
    }),
  });
}

describe("POST /api/bookings inline send", () => {
  beforeEach(() => {
    events.length = 0;
    outboxRows.length = 0;
    scheduledIds = [];
  });

  it("responds 201 and schedules the send only after commit, with both row ids", async () => {
    const res = await POST(bookingRequest());
    expect(res.status).toBe(201);
    // Both rows (visitor confirmation + staff alert) were enqueued in-tx…
    expect(outboxRows).toHaveLength(2);
    // …and the inline send was scheduled strictly after the commit.
    expect(events).toEqual(["committed", "scheduled"]);
    expect(scheduledIds).toEqual([[outboxRows[0].id, outboxRows[1].id]]);
  });
});
