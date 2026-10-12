import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildStatementRows, describeStatementEntry, chargeSubtitle, withChargeSubtitle } from "../statement";
import { generateReceiptPdf } from "../receipts/generateReceiptPdf";

const E = (over: Partial<Parameters<typeof buildStatementRows>[0][number]> & { id: string; type: string; amount: number }) => ({
  direction: "DEBIT",
  effectiveDate: new Date("2026-01-01"),
  createdAt: new Date("2026-01-01"),
  ...over,
});

describe("buildStatementRows", () => {
  it("runs charges, payments, discounts and reversals with a running balance", () => {
    const { rows, closing, totalCharges, totalPaid } = buildStatementRows([
      E({ id: "c1", type: "CHARGE_BASE", amount: 18_500_000, direction: "DEBIT", effectiveDate: new Date("2026-01-01"), createdAt: new Date("2026-01-01") }),
      E({ id: "p1", type: "PAYMENT", amount: 3_000_000, direction: "CREDIT", effectiveDate: new Date(2026, 1, 1, 12), createdAt: new Date(2026, 1, 1, 12) }),
      E({ id: "d1", type: "DISCOUNT", amount: 500_000, direction: "CREDIT", effectiveDate: new Date(2026, 0, 15, 12), createdAt: new Date(2026, 0, 15, 12) }),
      E({ id: "r1", type: "REVERSAL", amount: 3_000_000, direction: "DEBIT", effectiveDate: new Date(2026, 2, 1, 12), createdAt: new Date(2026, 2, 1, 12) }),
    ]);
    expect(rows.map((r) => r.balance)).toEqual([18_500_000, 18_000_000, 15_000_000, 18_000_000]);
    expect(rows[1].details).toBe("Discount");
    expect(closing).toBe(18_000_000);
    // Net charges: discounts/waivers reduce what is owed, so the Totals row
    // foots (charges − paid = balance): 18.5M − 0.5M = 18M.
    expect(totalCharges).toBe(18_000_000);
    expect(totalPaid).toBe(0); // 3M paid then fully reversed
  });

  it("orders by effective date (backdated payments land correctly), then creation", () => {
    const { rows } = buildStatementRows([
      E({ id: "p2", type: "PAYMENT", amount: 1_000_000, direction: "CREDIT", effectiveDate: new Date(2026, 4, 1, 12), createdAt: new Date(2026, 5, 1, 12) }),
      E({ id: "p1", type: "PAYMENT", amount: 2_000_000, direction: "CREDIT", effectiveDate: new Date(2026, 3, 1, 12), createdAt: new Date(2026, 5, 2, 12) }),
    ]);
    expect(rows.map((r) => r.date)).toEqual(["01-04-2026", "01-05-2026"]);
    expect(rows.map((r) => r.balance)).toEqual([-2_000_000, -3_000_000]);
  });

  it("describes payment rows with method, bank ref and receipt ref", () => {
    // Details carry the method; bank ref + receipt ref ride the second line
    // (refLine) — asserted together so the refs are proven to render.
    expect(
      describeStatementEntry({ id: "x", type: "PAYMENT", amount: 1, direction: "CREDIT", effectiveDate: new Date(), createdAt: new Date(), method: "Bank Transfer", bankReference: "TRF-1", receiptRef: "RCT-1" })
    ).toBe("Payment received, Bank Transfer");
    const { rows } = buildStatementRows([
      E({ id: "x", type: "PAYMENT", amount: 1_000_000, direction: "CREDIT", method: "Bank Transfer", bankReference: "TRF-1", receiptRef: "RCT-1" }),
    ]);
    expect(rows[0].line2).toBe("Ref TRF-1 · Receipt RCT-1");
  });

  it("prints the property line under the contract charge (layout reference)", () => {
    expect(chargeSubtitle("Sunrise Estate", "SUN-P1-500SQM")).toBe("Sunrise Estate, SUN-P1-500SQM");
    expect(chargeSubtitle("Sunrise Estate", null)).toBe("Sunrise Estate");
    expect(chargeSubtitle(null, null)).toBeNull();
    const { rows } = buildStatementRows(
      withChargeSubtitle(
        [
          E({ id: "c1", type: "CHARGE_BASE", amount: 18_500_000, direction: "DEBIT" }),
          E({ id: "p1", type: "PAYMENT", amount: 3_000_000, direction: "CREDIT", method: "Bank Transfer", receiptRef: "RCT-1" }),
        ],
        chargeSubtitle("Sunrise Estate", "SUN-P1-500SQM")
      )
    );
    expect(rows[0]).toMatchObject({ details: "Contract price", line2: "Sunrise Estate, SUN-P1-500SQM" });
    // Payments keep the ref line — the subtitle only ever lands on charges.
    expect(rows[1]).toMatchObject({ details: "Payment received, Bank Transfer", line2: "Receipt RCT-1" });
  });
});

describe("single statement PDF path", () => {
  // The jsPDF hand-positioned generator is deleted: every statement PDF comes
  // from renderStatementPdf (supplied HTML template + Chromium). This test
  // fails if the old generator — or a second one — is reintroduced.
  it("has exactly one PDF producer and no hand-positioned text", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src", "lib", "statement.ts"),
      "utf8"
    );
    expect(src).not.toContain("generateStatementPdf");
    expect(src).not.toContain("jspdf");
    expect(src).not.toContain("addImage");
    const producers = fs
      .readFileSync(path.join(process.cwd(), "src", "lib", "statement-pdf.ts"), "utf8")
      .match(/export async function renderStatementPdf/);
    expect(producers?.length).toBe(1);
  });
});

describe("receipt PDF step-4 content smoke", () => {
  const base = {
    ref: "RCT-2026-00001",
    issuedDate: "01-03-2026",
    clientName: "Ada Obi",
    clientAddress: "Peninsula · Plot · PEN-1",
    clientPhone: "+2348012345678",
    clientEmail: "ada@x.com",
    estateName: "Belgrove Peninsula",
    unitType: "Plot",
    plotCode: "PEN-1",
    amountPaid: 4_000_000,
    soldPrice: 10_000_000,
    payments: [{ date: "01-03-2026", method: "Bank Transfer", amount: 4_000_000 }],
    receiptUrl: "https://www.belgrovehomes.com/r/tok",
    totalPayable: 10_000_000,
    previouslyPaid: 0,
    totalPaidAfter: 4_000_000,
    outstandingBalance: 6_000_000,
  };

  it("renders PART and FINAL variants without throwing (fonts mandatory)", () => {
    const part = generateReceiptPdf({
      ...base,
      label: "PART PAYMENT",
      accountRef: "TXN-2026-00001 · BEL-2026-00001",
      paymentDate: "01-03-2026",
      paymentMethodLabel: "Bank Transfer",
      bankReference: "TRF-88231",
      history: [
        { date: "01-02-2026", method: "Cash", amount: 1_000_000, receiptRef: "RCT-2026-00000", runningBalance: 9_000_000, isCurrent: false },
        { date: "01-03-2026", method: "Bank Transfer", amount: 4_000_000, receiptRef: "RCT-2026-00001", runningBalance: 6_000_000, isCurrent: true },
      ],
    });
    const fin = generateReceiptPdf({ ...base, amountPaid: 10_000_000, label: "FINAL PAYMENT, ACCOUNT SETTLED", outstandingBalance: 0, totalPaidAfter: 10_000_000 });
    for (const pdf of [part, fin]) {
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdf.length).toBeGreaterThan(20_000);
    }
    // Different content → different bytes (labels/history actually render).
    expect(Buffer.compare(part, fin)).not.toBe(0);
  });
});
