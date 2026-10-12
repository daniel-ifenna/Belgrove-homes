import { describe, it, expect } from "vitest";
import {
  BUSINESS_TIMEZONE,
  lagosToUtc,
  lagosDayKey,
  startOfTodayLagos,
  lagosTodayInput,
  lagosMonthRange,
  formatLagos,
  formatDateDMY,
  toDateOnlyNoonUtc,
  parseSlotMinutes,
} from "../time";

// These tests must pass identically under TZ=UTC and TZ=America/Los_Angeles
// (the module never touches server-local time — only Intl with an explicit zone).
const DOC_SRC = [
  "src/lib/paymentService.ts",
  "src/lib/paymentConfirmation.ts",
  "src/lib/receipt-render.ts",
  "src/lib/statement.ts",
  "src/lib/finance/ledger.ts",
  "src/lib/finance/index.ts",
  "src/app/r/[token]/page.tsx",
  "src/app/admin/payments/page.tsx",
  "src/app/admin/receipts/page.tsx",
  "src/app/api/admin/transactions/route.ts",
  "src/app/api/admin/transactions/[id]/payments/[paymentId]/confirm/route.ts",
  "src/app/api/admin/transactions/[id]/payments/[paymentId]/correct/route.ts",
  "src/app/api/admin/transactions/ledger/route.ts",
];

function walkMoney(files: string[]): string[] {
  const path = require("node:path") as typeof import("node:path");
  return files.map((f) => path.join(process.cwd(), f));
}
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

  it("formatDateDMY is zone-explicit: UTC midnight never shifts a day", () => {
    // The TXN-2026-62831 bug: stored 2026-08-09T00:00Z must print 09-08 in
    // Lagos (and UTC), never 08-08, regardless of server TZ.
    expect(formatDateDMY(new Date("2026-08-09T00:00:00.000Z"))).toBe("09-08-2026");
    expect(formatDateDMY(new Date("2026-08-09T00:00:00.000Z"), "UTC")).toBe("09-08-2026");
  });

  it("formatDateDMY holds month boundaries for date-only values", () => {
    // Date-only values (stored UTC midnight) keep their calendar date in
    // Lagos: 31 Aug never becomes September. Late-night INSTANTS still
    // resolve honestly (23:00Z Aug 31 is Sep 1 in Lagos) — which is why
    // effective dates are stored date-only, never as instants.
    expect(formatDateDMY(new Date("2026-08-31T00:00:00.000Z"))).toBe("31-08-2026");
    expect(formatDateDMY(new Date("2026-08-31T23:00:00.000Z"))).toBe("01-09-2026");
  });

  it("no money/document surface formats dates with the server-local zone", () => {    // Guard test: these paths must use formatDateDMY/formatLagos/formatDate.
    // Allowed: time.ts itself, booking-ui re-export, tests, and explicit-zone
    // Intl calls.
    const offenders: string[] = [];
    for (const file of walkMoney(DOC_SRC)) {
      const text = require("node:fs").readFileSync(file, "utf8");
      const lines = text.split("\n");
      lines.forEach((line: string, i: number) => {
        if (/(^|[^A-Za-z_])\.get(Date|Month|FullYear)\(\)/.test(line)) offenders.push(`${file}:${i + 1}`);
        if (/\.toLocale(DateString|TimeString)\(/.test(line) && !line.includes("timeZone")) offenders.push(`${file}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

describe("toDateOnlyNoonUtc", () => {
  it("stores form input as noon UTC on the same calendar date", () => {
    expect(toDateOnlyNoonUtc("2026-08-09").toISOString()).toBe("2026-08-09T12:00:00.000Z");
    expect(toDateOnlyNoonUtc("2026-09-24").toISOString()).toBe("2026-09-24T12:00:00.000Z");
  });

  it("holds the month boundary: 31 Aug never moves", () => {
    const d = toDateOnlyNoonUtc("2026-08-31");
    expect(formatDateDMY(d)).toBe("31-08-2026");
    expect(formatDateDMY(d, "UTC")).toBe("31-08-2026");
  });

  it("derives the Lagos calendar day for instant inputs (midnight window)", () => {
    // 23:30Z is already the next day in Lagos — the stored date follows Lagos.
    expect(formatDateDMY(toDateOnlyNoonUtc(new Date("2026-08-09T23:30:00.000Z")))).toBe("10-08-2026");
    // Midday UTC is the same Lagos day.
    expect(formatDateDMY(toDateOnlyNoonUtc(new Date("2026-08-09T12:00:00.000Z")))).toBe("09-08-2026");
  });

  it("rejects invalid input", () => {
    expect(() => toDateOnlyNoonUtc("not-a-date")).toThrow();
    expect(() => toDateOnlyNoonUtc(new Date("invalid"))).toThrow();
  });

  it("noon-UTC values print identically in Lagos and UTC (no off-by-one either way)", () => {
    for (const day of ["2026-08-09", "2026-08-12", "2026-08-19", "2026-09-24", "2026-08-31"]) {
      const d = toDateOnlyNoonUtc(day);
      expect(formatDateDMY(d)).toBe(formatDateDMY(d, "UTC"));
    }
  });
});
