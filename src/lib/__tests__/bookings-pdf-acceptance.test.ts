import { describe, it, expect, vi } from "vitest";
import { PDFParse } from "pdf-parse";

vi.mock("@/auth", () => ({
  auth: async () => ({ user: { id: "u1", name: "Admin", email: "admin@x.com", role: "admin" } }),
}));

// Realistic single booking shaped like the TXN-2026-41848 case: human note,
// system double-write (same text as message + as note), and an emoji lead.
const BOOKING = {
  id: "bk-live",
  ref: "BEL-2026-41848",
  name: "Daniel Ifenna",
  email: "daniel@example.com",
  phone: "+2348103760063",
  preferredDate: new Date("2026-09-30T09:00:00Z"),
  preferredTime: "10:00 AM",
  rescheduledDate: null,
  rescheduledTime: null,
  location: "Belgrove Peninsula",
  agentName: null,
  visitorAgentRaw: null,
  status: "active",
  leadTemperature: "hot",
  outcome: "interested",
  agentId: null,
  agent: null,
  assignedToUser: null,
  reviewedByUser: null,
  createdAt: new Date("2026-09-30T09:00:00Z"),
  updatedAt: new Date("2026-09-30T11:00:00Z"),
  lockedAt: null,
  activities: [],
  internalNotes: [
    { id: "n1", authorName: "Ada Admin", body: "Called client, confirmed interest in PEN-250SQM.", createdAt: new Date("2026-09-30T10:00:00Z") },
    // System double-write copy — must NOT appear in Internal Notes nor duplicate in history.
    { id: "n2", authorName: "System", body: "[Interested 🔥 Hot] Thank you for visiting Belgrove Peninsula", createdAt: new Date("2026-09-30T10:05:00Z") },
  ],
  messages: [
    { id: "m1", authorName: "System", message: "Thank you for visiting Belgrove Peninsula", createdAt: new Date("2026-09-30T10:05:00Z") },
    { id: "m2", authorName: "Ada Admin", message: "See https://example.com/very/long/path/that/should/wrap/inside/the/column/without/clipping-at-the-edge for details", createdAt: new Date("2026-09-30T10:10:00Z") },
  ],
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    inspectionBooking: { findMany: async () => [{ ...BOOKING }] },
    agent: { findUnique: async () => null },
  },
}));

import { NextRequest } from "next/server";
import { GET as exportBookings } from "@/app/api/admin/bookings/export/route";

describe("bookings PDF acceptance (TXN-2026-41848 shape)", () => {
  it("is portrait-only, <=2 pages, no clipped overflow, no emoji, no duplicates, correct paging", async () => {
    const res = await exportBookings(new NextRequest("http://localhost/api/admin/bookings/export"));
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());

    // Single orientation: every MediaBox is portrait (height > width).
    const boxes = buf.toString("latin1").match(/\/MediaBox\s*\[([\d. ]+)\]/g) ?? [];
    expect(boxes.length).toBeGreaterThanOrEqual(1);
    expect(boxes.length).toBeLessThanOrEqual(2);
    for (const b of boxes) {
      const dims = b.match(/[\d.]+/g)!.map(Number);
      expect(dims[3] - dims[1]).toBeGreaterThan(dims[2] - dims[0]);
    }

    const parser = new PDFParse({ data: buf });
    const { text } = await parser.getText();
    await parser.destroy();

    // No garbled emoji.
    expect(text).not.toMatch(/🔥/);
    // Long URL wrapped: no single line holds the whole run.
    expect(text).not.toContain("https://example.com/very/long/path/that/should/wrap/inside/the/column/without/clipping-at-the-edge");
    expect(text).toContain("example.com");
    // Dedupe: system text appears once (Message row), not twice as Message + Note.
    const occurrences = (text.match(/Thank you for visiting Belgrove Peninsula/g) ?? []).length;
    expect(occurrences).toBe(1);
    // Human note appears in Internal Notes.
    expect(text).toContain("Called client, confirmed interest");
    // Footer page count matches real pages.
    expect(text).toContain(`Page 1 of ${boxes.length}`);
    if (boxes.length > 1) expect(text).toContain(`Page ${boxes.length} of ${boxes.length}`);
  }, 30000);
});
