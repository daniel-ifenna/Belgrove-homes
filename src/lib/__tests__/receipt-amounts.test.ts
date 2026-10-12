import { describe, it, expect } from "vitest";
import { receiptAmountsRows, settlementLabel, buildReceiptHistory, appliedToLabel, installmentAppliedLabel } from "../receipt-amounts";

describe("receiptAmountsRows", () => {
  const base = {
    thisPayment: 2_905_000,
    installmentLabel: "Initial payment",
    totalPrice: 8_300_000,
    paidToDate: 2_905_000,
    balanceRemaining: 5_395_000,
    discount: 0,
  };

  it("orders rows: This payment, Installment, Total price, Paid to date, Balance remaining", () => {
    expect(receiptAmountsRows(base).map((r) => r.label)).toEqual([
      "This payment",
      "Installment",
      "Total price",
      "Paid to date",
      "Balance remaining",
    ]);
  });

  it("shows Discount only when > 0, last", () => {
    expect(receiptAmountsRows(base).some((r) => r.key === "discount")).toBe(false);
    const withDiscount = receiptAmountsRows({ ...base, discount: 200_000 });
    expect(withDiscount.map((r) => r.key).at(-1)).toBe("discount");
    expect(withDiscount.find((r) => r.key === "discount")?.value).toBe(200_000);
  });

  it("omits the Installment row when there is no label", () => {
    const rows = receiptAmountsRows({ ...base, installmentLabel: null });
    expect(rows.map((r) => r.key)).toEqual(["this-payment", "total-price", "paid-to-date", "balance"]);
  });
});

describe("settlementLabel", () => {
  it("PART while anything is outstanding, FINAL at zero or credit", () => {
    expect(settlementLabel(16_430_000)).toBe("PART PAYMENT");
    expect(settlementLabel(1)).toBe("PART PAYMENT");
    expect(settlementLabel(0)).toBe("FINAL PAYMENT, ACCOUNT SETTLED");
    expect(settlementLabel(-1_000_000)).toBe("FINAL PAYMENT, ACCOUNT SETTLED");
  });
});

describe("buildReceiptHistory", () => {
  const fmt = (d: Date | string) => {
    const x = new Date(d);
    return `${String(x.getDate()).padStart(2, "0")}-${String(x.getMonth() + 1).padStart(2, "0")}-${x.getFullYear()}`;
  };
  const noon = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);
  const pays = [
    { id: "p1", date: noon(2026, 8, 9), method: "Bank Transfer", amount: 3_000_000 },
    { id: "p2", date: noon(2026, 8, 19), method: "Bank Transfer", amount: 3_000_000 },
    { id: "p3", date: noon(2026, 9, 24), method: "Cash", amount: 2_750_000 },
  ];
  const refs = new Map([["p1", "RCT-1"], ["p2", "RCT-2"], ["p3", "RCT-3"]]);

  it("lists every payment with receipt refs and running balances", () => {
    const rows = buildReceiptHistory(pays, refs, "p3", 18_500_000, fmt);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ date: "09-08-2026", amount: 3_000_000, receiptRef: "RCT-1", runningBalance: 15_500_000, isCurrent: false });
    expect(rows[1]).toMatchObject({ runningBalance: 12_500_000, isCurrent: false });
    expect(rows[2]).toMatchObject({ receiptRef: "RCT-3", runningBalance: 9_750_000, isCurrent: true });
  });

  it("stops at the current payment (later payments excluded)", () => {
    const rows = buildReceiptHistory(pays, refs, "p2", 18_500_000, fmt);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ isCurrent: true, runningBalance: 12_500_000 });
  });

  it("orders by date then id, tolerating missing refs", () => {
    const rows = buildReceiptHistory([...pays].reverse(), new Map(), "p3", 18_500_000, fmt);
    expect(rows.map((r) => r.date)).toEqual(["09-08-2026", "19-08-2026", "24-09-2026"]);
    expect(rows[0].receiptRef).toBeNull();
  });
});

describe("installmentAppliedLabel / appliedToLabel", () => {
  it("labels the initial installment as Initial deposit", () => {
    expect(installmentAppliedLabel(0, "INITIAL")).toBe("Initial deposit");
    expect(installmentAppliedLabel(1, "MONTHLY")).toBe("Month 1");
    expect(installmentAppliedLabel(3, "MONTHLY")).toBe("Month 3");
  });

  it("describes a single-installment payment (TXN-2026-62831 payments 1-3)", () => {
    expect(
      appliedToLabel([{ installmentNumber: 0, type: "INITIAL", amount: 3_000_000, scheduledAmount: 9_250_000 }])
    ).toBe("Initial deposit ₦3,000,000 of ₦9,250,000");
  });

  it("describes a split payment (TXN-2026-62831 corrected payment 4: ₦250k clears Initial, rest to Month 1)", () => {
    expect(
      appliedToLabel([
        { installmentNumber: 1, type: "MONTHLY", amount: 2_750_000, scheduledAmount: 3_083_333 },
        { installmentNumber: 0, type: "INITIAL", amount: 250_000, scheduledAmount: 9_250_000 },
      ])
    ).toBe("Initial deposit ₦250,000 of ₦9,250,000, Month 1 ₦2,750,000 of ₦3,083,333");
  });
});
