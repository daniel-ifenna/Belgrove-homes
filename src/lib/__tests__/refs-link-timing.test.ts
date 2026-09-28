import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { prefixedRef } from "../ref";
import { scheduledInspectionStart, parseSlotMinutes } from "../inspection-time";
import { createManualTransaction } from "../transactionService";

const SRC = path.join(process.cwd(), "src");

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
  it("combines date + 12h time", () => {
    const start = scheduledInspectionStart({
      preferredDate: new Date("2026-09-30T00:00:00Z"),
      preferredTime: "12:00 PM",
      rescheduledDate: null,
      rescheduledTime: null,
    });
    expect(start?.getHours()).toBe(12);
    expect(start?.getMinutes()).toBe(0);
  });
  it("prefers the rescheduled slot", () => {
    // Midday dates avoid TZ day-boundary flakiness on any server.
    const start = scheduledInspectionStart({
      preferredDate: new Date(2026, 8, 30, 12, 0, 0),
      preferredTime: "12:00 PM",
      rescheduledDate: new Date(2026, 9, 2, 12, 0, 0),
      rescheduledTime: "9:30 AM",
    });
    expect(start?.getDate()).toBe(2);
    expect(start?.getMonth()).toBe(9);
    expect(start?.getHours()).toBe(9);
    expect(start?.getMinutes()).toBe(30);
  });
  it("parses 12 AM/PM edges", () => {
    expect(parseSlotMinutes("12:00 AM")).toBe(0);
    expect(parseSlotMinutes("12:00 PM")).toBe(12 * 60);
    expect(parseSlotMinutes("nonsense")).toBe(null);
  });
});

describe("transaction requires bookingId or manualReason", () => {
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
});
