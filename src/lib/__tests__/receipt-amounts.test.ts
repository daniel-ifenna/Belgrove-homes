import { describe, it, expect } from "vitest";
import { receiptAmountsRows } from "../receipt-amounts";

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
