import { describe, it, expect } from "vitest";
import {
  BUSINESS_TIMEZONE,
  lagosToUtc,
  lagosDayKey,
  startOfTodayLagos,
  lagosTodayInput,
  lagosMonthRange,
  formatLagos,
  parseSlotMinutes,
} from "../time";

// These tests must pass identically under TZ=UTC and TZ=America/Los_Angeles
// (the module never touches server-local time — only Intl with an explicit zone).
describe("business timezone", () => {
  it("uses Africa/Lagos by default", () => {
    expect(BUSINESS_TIMEZONE).toBe("Africa/Lagos");
  });

  it("lagosToUtc interprets wall time in Lagos (UTC+1, no DST)", () => {
    // 12:00 PM Sep 30 in Lagos = 11:00 UTC.
    expect(lagosToUtc("2026-09-30", "12:00 PM").toISOString()).toBe("2026-09-30T11:00:00.000Z");
    // Date-only input = Lagos midnight = previous day 23:00 UTC.
    expect(lagosToUtc("2026-09-30").toISOString()).toBe("2026-09-29T23:00:00.000Z");
  });

  it("resolves the BEL-2026-62307 confusion: one Lagos day, one instant", () => {
    // Stored canonical instant displays as Sep 30 in Lagos regardless of server TZ.
    expect(lagosDayKey(new Date("2026-09-29T23:00:00.000Z"))).toBe("2026-09-30");
    expect(formatLagos(new Date("2026-09-29T23:00:00.000Z"))).toContain("30 Sept 2026");
  });

  it("startOfTodayLagos is Lagos midnight as UTC", () => {
    const start = startOfTodayLagos(new Date("2026-09-28T12:00:00Z"));
    expect(start.toISOString()).toBe("2026-09-27T23:00:00.000Z");
    expect(lagosDayKey(start)).toBe("2026-09-28");
    expect(lagosTodayInput(new Date("2026-09-28T12:00:00Z"))).toBe("2026-09-28");
  });

  it("month range follows Lagos calendar", () => {
    const { start, end } = lagosMonthRange(new Date("2026-09-15T12:00:00Z"));
    expect(start.toISOString()).toBe("2026-08-31T23:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-30T23:00:00.000Z");
  });

  it("parses 12h slots", () => {
    expect(parseSlotMinutes("12:00 AM")).toBe(0);
    expect(parseSlotMinutes("12:00 PM")).toBe(720);
    expect(parseSlotMinutes("9:30 AM")).toBe(570);
    expect(parseSlotMinutes("bogus")).toBe(null);
  });
});
