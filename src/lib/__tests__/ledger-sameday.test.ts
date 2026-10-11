import { describe, it, expect, vi } from "vitest";
import { PDFParse } from "pdf-parse";

vi.mock("@/auth", () => ({
  auth: async () => ({ user: { id: "u1", name: "Admin", email: "admin@x.com", role: "admin" } }),
}));

// Mirror of the live TXN-2026-41848 shape that exposed the ordering bug:
// the sale was created 30 Sep 11:15 but the payment is dated 30 Sep 00:00.
// Same display date — the charge must still print before the payment.
const TXNS = [
  {
    id: "t-live",
    ref: "TXN-2026-41848",
    customerName: "Daniel Ifenna",
    customerEmail: "daniel@example.com",
    estate: "Belgrove Peninsula",
    plotCode: "PEN-250SQM",
    unitType: "4-Bed Semi-Detached Duplex",
    totalPayable: 19_400_000,
    createdAt: new Date("2026-09-30T11:15:52Z"),
    paymentPlan: { name: "0-3 Months" },
    payments: [
      {
        id: "p-live-1",
        amount: 9_700_000,
        paymentDate: new Date("2026-09-30T00:00:00Z"),
        createdAt: new Date("2026-09-30T11:24:47Z"),
        paymentMethod: "Bank Transfer",
        paymentReference: "PAY-2026-64853",
        status: "CONFIRMED" as const,
      },
    ],
    receipts: [{ paymentId: "p-live-1", ref: "RCT-2026-52447" }],
  },
];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    transaction: {
      findMany: async () => TXNS,
    },
  },
}));

import { NextRequest } from "next/server";
import {
  GET as exportLedger,
  LEDGER_COLUMN_PCTS,
  LEDGER_MARGIN_MM,
  LEDGER_PAGE_W_MM,
  ledgerColumnWidthsMm,
} from "@/app/api/admin/transactions/ledger/route";

describe("ledger geometry", () => {
  it("percentage widths sum to 100 and resolve to exactly the printable width", () => {
    expect(LEDGER_COLUMN_PCTS.reduce((a, b) => a + b, 0)).toBe(100);
    const usable = LEDGER_PAGE_W_MM - LEDGER_MARGIN_MM * 2;
    const widths = ledgerColumnWidthsMm();
    expect(widths).toHaveLength(9);
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(usable, 10);
    for (const w of widths) expect(w).toBeGreaterThan(0);
  });
});

describe("ledger same-day charge-before-payment", () => {
  it("lists debit 19.4M before credit 9.7M with exact running balances", async () => {
    const res = await exportLedger(new NextRequest("http://localhost/api/admin/transactions/ledger"));
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());

    // Single landscape page: one MediaBox, wider than tall (no portrait
    // page, no mixed orientations possible).
    const boxes = buf.toString("latin1").match(/\/MediaBox\s*\[([\d. ]+)\]/g) ?? [];
    expect(boxes).toHaveLength(1);
    const dims = boxes[0]!.match(/[\d.]+/g)!.map(Number);
    expect(dims[2] - dims[0]).toBeGreaterThan(dims[3] - dims[1]);

    const parser = new PDFParse({ data: buf });
    const { text: raw } = await parser.getText();
    await parser.destroy();
    const text = raw.replace(/\u00A0/g, " ");

    // 1. Opening: NGN 0 in Company Balance, before every row.
    expect(text).toContain("Opening balance, balance brought forward");
    expect(text).toContain("NGN 0");
    expect(text.indexOf("Opening balance")).toBeLessThan(text.indexOf("PAY-2026-64853"));

    // 2. Charge before payment despite the 00:00 payment instant predating
    // the 11:15 creation instant on the same display date.
    const debitIdx = text.indexOf("NGN 19,400,000");
    const creditIdx = text.indexOf("PAY-2026-64853");
    expect(debitIdx).toBeGreaterThan(-1);
    expect(creditIdx).toBeGreaterThan(-1);
    expect(debitIdx).toBeLessThan(creditIdx);

    // 3. Installment + company balances: 19.4M after the charge, 9.7M after
    // the payment; closing equals total outstanding.
    expect(text).toContain("NGN 9,700,000");
    expect(text).not.toContain("NGN -");

    // 4. Totals row labelled in the first cell with all three figures.
    const totalsIdx = text.indexOf("Totals");
    expect(totalsIdx).toBeGreaterThan(creditIdx);
    expect(text.slice(totalsIdx)).toContain("NGN 19,400,000");
    expect(text.slice(totalsIdx)).toContain("NGN 9,700,000");

    // 5. Credit row carries both refs.
    expect(text).toContain("RCT-2026-52447");
  }, 30000);
});
