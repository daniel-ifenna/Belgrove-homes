import { describe, it, expect, vi, beforeEach } from "vitest";

// POST /api/bookings sends directly through Resend after commit (no queue):
// visitor confirmation + staff alert go out in-request with stable per-booking
// idempotency keys, and email failure never fails the booking.

const events: string[] = [];
const sent: { fn: string; args: unknown[] }[] = [];

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
  const tx = {
    inspectionBooking: { create: async () => ({ ...createdBooking }) },
    notification: { createMany: async () => ({ count: 1 }) },
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

vi.mock("@/lib/email/emailService", () => ({
  sendBookingReceived: async (...args: unknown[]) => {
    events.push("visitor-email");
    sent.push({ fn: "sendBookingReceived", args });
    return { sent: true, error: null };
  },
  sendAdminNewBookingAlert: async (...args: unknown[]) => {
    events.push("admin-email");
    sent.push({ fn: "sendAdminNewBookingAlert", args });
    return { sent: true, error: null };
  },
}));

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

describe("POST /api/bookings direct send", () => {
  beforeEach(() => {
    events.length = 0;
    sent.length = 0;
  });

  it("responds 201 and sends both emails after commit with stable keys", async () => {
    const res = await POST(bookingRequest());
    expect(res.status).toBe(201);
    // Both emails go out strictly after the commit, in-request.
    expect(events).toEqual(["committed", "visitor-email", "admin-email"]);
    expect(sent).toHaveLength(2);
    const visitor = sent.find((s) => s.fn === "sendBookingReceived")!;
    const admin = sent.find((s) => s.fn === "sendAdminNewBookingAlert")!;
    expect(visitor.args[0]).toBe("buyer@example.com");
    expect(visitor.args[2]).toEqual({ idempotencyKey: "booking:bk-1:booking_received:buyer@example.com" });
    expect(admin.args[0]).toEqual(["staff@example.com"]);
    expect(admin.args[2]).toEqual({ idempotencyKey: "booking:bk-1:admin_alert" });
  });
});
