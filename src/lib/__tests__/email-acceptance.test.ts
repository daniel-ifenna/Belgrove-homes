import { describe, it, expect } from "vitest";
import {
  computeNextAttemptAt,
  priorityForType,
  isPermanentSendError,
} from "../email/outbox";

describe("email retry policy", () => {
  it("permanent errors stop retrying and are flagged", () => {
    expect(isPermanentSendError("ENOENT: no such file or directory, mkdir '/var/task/storage/receipts'")).toBe(true);
    expect(isPermanentSendError("Resend error 400: validation failed")).toBe(true);
    expect(isPermanentSendError("Invalid recipient address")).toBe(true);
    expect(isPermanentSendError("Resend request timed out after 10012ms")).toBe(false);
    expect(isPermanentSendError("SMTP down")).toBe(false);
    expect(isPermanentSendError(null)).toBe(false);
  });

  it("backoff has jitter (same attempt spreads, stays exponential)", () => {
    const now = new Date("2026-09-30T12:00:00Z");
    const first = Array.from({ length: 10 }, () => computeNextAttemptAt(now, 1).getTime() - now.getTime());
    // ~30s ±20%: 24s..36s.
    for (const ms of first) {
      expect(ms).toBeGreaterThanOrEqual(24_000 - 1);
      expect(ms).toBeLessThanOrEqual(36_000 + 1);
    }
    // Later attempts grow.
    const fourth = computeNextAttemptAt(now, 4).getTime() - now.getTime();
    expect(fourth).toBeGreaterThan(25 * 60_000);
  });

  it("receipts outrank bulk mail", () => {
    expect(priorityForType("receipt")).toBeGreaterThanOrEqual(priorityForType("transaction_confirmation"));
    expect(priorityForType("transaction_confirmation")).toBeGreaterThan(priorityForType("booking_received"));
  });
});
