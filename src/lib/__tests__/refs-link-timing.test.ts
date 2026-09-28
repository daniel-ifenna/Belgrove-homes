import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { prefixedRef, generatePrefixedRef } from "../ref";
import { scheduledInspectionStart, parseSlotMinutes } from "../inspection-time";
import { createManualTransaction } from "../transactionService";

const SRC = path.join(process.cwd(), "src");

describe("generatePrefixedRef", () => {
  it("returns the first non-colliding ref", async () => {
    const seen = ["PAY-2026-00001"];
    const ref = await generatePrefixedRef("PAY", async (r) => seen.includes(r), "payment");
    expect(ref).toMatch(/^PAY-\d{4}-\d{5}$/);
    expect(seen).not.toContain(ref);
  });
  it("retries past collisions and throws after 5 attempts", async () => {
    await expect(generatePrefixedRef("PAY", async () => true, "payment")).rejects.toThrow(/unique payment reference/i);
  });
});

describe("reference prefixes", () => {
  it("mints BKG/TXN/PAY/RCT refs, never BEL for new rows", () => {
    expect(prefixedRef("BKG")).toMatch(/^BKG-\d{4}-\d{5}$/);
    expect(prefixedRef("TXN")).toMatch(/^TXN-\d{4}-\d{5}$/);
    expect(prefixedRef("PAY")).toMatch(/^PAY-\d{4}-\d{5}$/);
    expect(prefixedRef("RCT")).toMatch(/^RCT-\d{4}-\d{5}$/);
    expect(prefixedRef("BKG")).not.toBe(prefixedRef("BKG"));
  });
  it("existing BEL refs are untouched (generator never rewrites refs)", () => {
    const refSrc = fs.readFileSync(path.join(SRC, "lib/ref.ts"), "utf8");
    expect(refSrc).not.toContain("prisma.inspectionBooking.update");
    expect(refSrc).not.toContain("prisma.receipt.update");
    expect(refSrc).not.toContain("prisma.transaction.update");
  });
});

describe("scheduledInspectionStart", () => {
  it("combines date + 12h time as a Lagos instant (TZ-independent)", () => {
    const start = scheduledInspectionStart({
      preferredDate: new Date("2026-09-30T00:00:00Z"),
      preferredTime: "12:00 PM",
      rescheduledDate: null,
      rescheduledTime: null,
    });
    // 12:00 PM Sep 30 in Lagos (UTC+1) = 11:00 UTC, on every server.
    expect(start?.toISOString()).toBe("2026-09-30T11:00:00.000Z");
  });
  it("prefers the rescheduled slot", () => {
    // Midday dates avoid TZ day-boundary flakiness on any server.
    const start = scheduledInspectionStart({
      preferredDate: new Date(2026, 8, 30, 12, 0, 0),
      preferredTime: "12:00 PM",
      rescheduledDate: new Date(2026, 9, 2, 12, 0, 0),
      rescheduledTime: "9:30 AM",
    });
    // Rescheduled day in Lagos + 9:30 AM Lagos wall time.
    expect(start?.toISOString()).toBe("2026-10-02T08:30:00.000Z");
  });
  it("parses 12 AM/PM edges", () => {
    expect(parseSlotMinutes("12:00 AM")).toBe(0);
    expect(parseSlotMinutes("12:00 PM")).toBe(12 * 60);
    expect(parseSlotMinutes("nonsense")).toBe(null);
  });
});

describe("booking → transaction handoff", () => {
  it("is idempotent: the form redirects to the already-linked transaction", () => {
    const text = fs.readFileSync(path.join(SRC, "app/admin/transactions/new/page.tsx"), "utf8");
    expect(text).toContain("if (existing) redirect(");
  });
  it("transaction page shows Booking link or Manual reason", () => {
    const text = fs.readFileSync(path.join(SRC, "app/admin/transactions/[id]/page.tsx"), "utf8");
    expect(text).toContain("Booking {transaction.booking.ref}");
    expect(text).toContain("Manual — {transaction.manualReason}");
  });
  it("createManualTransaction rejects a blank reason before any DB work", async () => {
    await expect(
      createManualTransaction({
        customerName: "A",
        customerEmail: "a@x.com",
        estate: "E",
        plotQuantity: 1,
        unitPrice: 100,
        paymentPlanCode: "OUTRIGHT",
        manualReason: "   ",
      })
    ).rejects.toThrow(/reason/i);
  });
  it("API route enforces the rule", () => {
    const text = fs.readFileSync(path.join(SRC, "app/api/admin/transactions/route.ts"), "utf8");
    expect(text).toContain("bookingId OR a non-empty manualReason");
    expect(text).toContain("manualReason");
  });
});

describe("mark_active timing rule", () => {
  it("route rejects early activation without an override reason", () => {
    const text = fs.readFileSync(path.join(SRC, "app/api/admin/bookings/[id]/route.ts"), "utf8");
    expect(text).toContain("scheduledInspectionStart");
    expect(text).toContain("overrideReason");
    expect(text).toContain("Provide an override reason");
  });
  it("route requires inspectedAt for new outcomes", () => {
    const text = fs.readFileSync(path.join(SRC, "app/api/admin/bookings/[id]/route.ts"), "utf8");
    expect(text).toContain("mark active) before recording an outcome");
  });
  it("mark_active stamps inspectedAt", () => {
    const text = fs.readFileSync(path.join(SRC, "app/api/admin/bookings/[id]/route.ts"), "utf8");
    expect(text).toContain("inspectedAt: new Date()");
  });
  it("scheduled start is Lagos-explicit, never server-local", () => {
    const text = fs.readFileSync(path.join(SRC, "lib/inspection-time.ts"), "utf8");
    expect(text).toContain("lagosToUtc");
    expect(text).toContain("lagosDayKey");
    expect(text).not.toMatch(/\.setHours\(/);
  });
});
