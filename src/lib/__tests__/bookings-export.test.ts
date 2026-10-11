import { describe, it, expect, vi } from "vitest";
import { PDFParse } from "pdf-parse";

vi.mock("@/auth", () => ({
  auth: async () => ({ user: { id: "u1", name: "Admin", email: "admin@x.com", role: "admin" } }),
}));

// Mirrors the live BEL-2026-90537 journey (TXN-2026-41848): approval,
// interested→hot with a System message+note double-write, a transaction
// line pair, sold pair, one human admin note with emoji/arrow/long run,
// and one reschedule. The export must print each event once, strip every
// emoji, fold arrows, and fit in ≤2 portrait pages.
const UNBROKEN = "Z".repeat(120);
const INTERESTED_TEXT =
  "Thank you for visiting Belgrove Peninsula with Belgrove Homes. To formalize your interest, please complete the subscription form here: https://tally.so/r/RG9ryp. Hot search priority.";
const TXN_TEXT = "Transaction TXN-2026-41848 created (0-3 Months plan), confirmation email queued.";
const SOLD_TEXT = "Congratulations! Your interest in Belgrove Peninsula (ref BEL-2026-90537) is now confirmed as SOLD.";

const BOOKING = {
  id: "bk-1",
  ref: "BEL-2026-90537",
  name: "Daniel Ifenna",
  email: "daniel@example.com",
  phone: "+2348012345678",
  preferredDate: new Date("2026-09-20T09:00:00Z"),
  preferredTime: "10:00 AM",
  rescheduledDate: new Date("2026-09-22T09:00:00Z"),
  rescheduledTime: "02:00 PM",
  location: "Belgrove Peninsula · 4-Bedroom Semi-Detached Duplex · PEN-250SQM",
  agentName: null,
  visitorAgentRaw: null,
  status: "closed",
  leadTemperature: "hot",
  outcome: "sold",
  agent: { id: "a1", name: "Amara Eze", email: "amara@x.com", category: "staff" },
  assignedToUser: null,
  reviewedByUser: null,
  createdAt: new Date("2026-09-15T09:00:00Z"),
  updatedAt: new Date("2026-09-30T11:30:00Z"),
  lockedAt: new Date("2026-09-30T11:30:00Z"),
  activities: [
    { action: "approve", actorName: "Admin", createdAt: new Date("2026-09-16T09:00:00Z"), note: "Auto: approved" },
    { action: "reschedule", actorName: "Admin", createdAt: new Date("2026-09-21T09:00:00Z"), note: "Client asked to move → Tuesday" },
    { action: "record_outcome", actorName: "Admin", createdAt: new Date("2026-09-25T09:00:00Z"), note: "Interested: auto hot" },
    { action: "record_outcome", actorName: "Admin", createdAt: new Date("2026-09-30T11:00:00Z"), note: "Sold: closing" },
  ],
  internalNotes: [
    { authorId: "u1", authorName: "Admin", body: `Client called back 🔥 — wants plot → allocation ${UNBROKEN} end`, createdAt: new Date("2026-09-26T09:00:00Z") },
    { authorId: null, authorName: "System", body: `[Interested → Hot] ${INTERESTED_TEXT}`, createdAt: new Date("2026-09-25T09:01:00Z") },
    { authorId: null, authorName: "System", body: `[Transaction] ${TXN_TEXT}`, createdAt: new Date("2026-09-30T10:00:00Z") },
    { authorId: null, authorName: "System", body: `[Sold] ${SOLD_TEXT}`, createdAt: new Date("2026-09-30T11:01:00Z") },
  ],
  messages: [
    { authorName: "System", message: INTERESTED_TEXT, createdAt: new Date("2026-09-25T09:00:00Z") },
    { authorName: "System", message: TXN_TEXT, createdAt: new Date("2026-09-30T10:00:00Z") },
    { authorName: "System", message: SOLD_TEXT, createdAt: new Date("2026-09-30T11:00:00Z") },
  ],
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    inspectionBooking: {
      findMany: async () => [BOOKING],
    },
    agent: { findUnique: async () => null },
  },
}));

import { NextRequest } from "next/server";
import { GET as exportBookings } from "@/app/api/admin/bookings/export/route";

function pageSizes(buf: Buffer): { w: number; h: number }[] {
  const out: { w: number; h: number }[] = [];
  const re = /\/MediaBox\s*\[([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(buf.toString("latin1")))) {
    out.push({ w: Number(m[3]) - Number(m[1]), h: Number(m[4]) - Number(m[2]) });
  }
  return out;
}

describe("bookings export PDF (single rich booking)", () => {
  it("fits in 2 portrait pages with correct footers, no emoji, no dupes, no clipping", async () => {
    const res = await exportBookings(new NextRequest("http://localhost/api/admin/bookings/export?q=BEL-2026-90537"));
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());

    // One orientation everywhere: every page portrait A4, identical size.
    const pages = pageSizes(buf);
    expect(pages.length).toBeGreaterThanOrEqual(1);
    expect(pages.length).toBeLessThanOrEqual(2);
    for (const p of pages) {
      expect(p.h).toBeGreaterThan(p.w);
      expect(p.w).toBeCloseTo(pages[0]!.w, 5);
      expect(p.h).toBeCloseTo(pages[0]!.h, 5);
    }

    const parser = new PDFParse({ data: buf });
    const { text } = await parser.getText();
    await parser.destroy();

    // Footer page count matches the real page count on every page.
    expect(text).toContain(`Page 1 of ${pages.length}`);
    if (pages.length === 2) expect(text).toContain("Page 2 of 2");

    // Every emoji stripped ("Hot search priority" keeps its word, loses 🔥);
    // arrows folded to ASCII so helvetica measures them correctly.
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(text).not.toContain("→");
    expect(text).toContain("Hot search priority");
    expect(text).toContain("->");

    // Each automated event exactly once: the interested text survives only
    // as the single Message row (System note copy dropped, and System
    // copies never leak into Internal Notes).
    const hits = text.split("formalize your interest").length - 1;
    expect(hits).toBe(1);

    // Human admin note present (its section + timeline), long run wrapped.
    expect(text).toContain("Client called back");
    expect(text).not.toContain(UNBROKEN);

    // Booking identity intact.
    expect(text).toContain("BEL-2026-90537");
    expect(text).toContain("Daniel Ifenna");
  }, 30000);
});
