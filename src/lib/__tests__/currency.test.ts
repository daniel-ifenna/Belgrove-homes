import { describe, it, expect } from "vitest";
import { formatCellNaira, formatNaira, formatSignedNaira } from "../currency";

describe("formatCellNaira (statement table cells)", () => {
  it("prints bare numbers with separators, '-' for missing", () => {
    expect(formatCellNaira(18500000)).toBe("18,500,000");
    expect(formatCellNaira(0)).toBe("0");
    expect(formatCellNaira(null)).toBe("-");
    expect(formatCellNaira(undefined)).toBe("-");
  });

  it("prints negatives as -N, never N-", () => {
    expect(formatCellNaira(-3000000)).toBe("-3,000,000");
  });
});

describe("summary/closing formatters", () => {
  it("negatives as -₦N, zero as ₦0", () => {
    expect(formatSignedNaira(-3000000)).toBe("-₦3,000,000");
    expect(formatSignedNaira(0)).toBe("₦0");
    expect(formatNaira(6500000)).toBe("₦6,500,000");
  });
});
