import { describe, it, expect, vi } from "vitest";
import { PDFParse } from "pdf-parse";

vi.mock("@/auth", () => ({
  auth: async () => ({ user: { id: "u1", name: "Admin", email: "admin@x.com", role: "admin" } }),
}));

// Company ledger fixture: 3 transactions across 2 customers.
// A1: 10M sale 01 Sep, 4M paid 05 Sep, 6M paid 20 Sep (fully paid).
// B1: 8M sale 03 Sep, 3M paid 04 Sep (5M outstanding).
// A2: 5M sale 10 Sep, unpaid (5M outstanding).
// Total outstanding = 0 + 5M + 5M = 10M.
function pay(id: string, ref: string, amount: number, paymentDate: string) {
  return {
    id,
    amount,
    paymentDate: new Date(`${paymentDate}T00:00:00Z`),
    createdAt: new Date(`${paymentDate}T10:00:00Z`),
    paymentMethod: "Bank Transfer",
    paymentReference: ref,
    status: "CONFIRMED" as const,
  };
}

const TXNS = [
  {
    id: "t-a1",
    ref: "TXN-2026-00011",
    customerName: "Adaeze Okonkwo",
    customerEmail: "ada@example.com",
    estate: "Belgrove Peninsula",
    plotCode: "PEN-A1",
    unitType: "4-Bed Semi-Detached Duplex",
    totalPayable: 10_000_000,
    createdAt: new Date("2026-09-01T09:00:00Z"),
    paymentPlan: { name: "0-3 Months" },
    payments: [pay("p-a1-1", "PAY-2026-00011", 4_000_000, "2026-09-05"), pay("p-a1-2", "PAY-2026-00012", 6_000_000, "2026-09-20")],
    receipts: [
      { paymentId: "p-a1-1", ref: "RCT-2026-00011" },
      { paymentId: "p-a1-2", ref: "RCT-2026-00012" },
    ],
  },
  {
    id: "t-b1",
    ref: "TXN-2026-00012",
    customerName: "Chidi Eze",
    customerEmail: "chidi@example.com",
    estate: "Belgrove Peninsula",
    plotCode: "PEN-B1",
    unitType: "3-Bedroom Terrace Duplex",
    totalPayable: 8_000_000,
    createdAt: new Date("2026-09-03T09:00:00Z"),
    paymentPlan: { name: "0-3 Months" },
    payments: [pay("p-b1-1", "PAY-2026-00013", 3_000_000, "2026-09-04")],
    receipts: [{ paymentId: "p-b1-1", ref: "RCT-2026-00013" }],
  },
  {
    id: "t-a2",
    ref: "TXN-2026-00013",
    customerName: "Adaeze Okonkwo",
    customerEmail: "ada@example.com",
    estate: "Belgrove Peninsula",
    plotCode: "PEN-A2",
    unitType: "Plot",
    totalPayable: 5_000_000,
    createdAt: new Date("2026-09-10T09:00:00Z"),
    paymentPlan: { name: "Outright" },
    payments: [],
    receipts: [],
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
import { GET as exportLedger } from "@/app/api/admin/transactions/ledger/route";

async function ledgerText(url: string): Promise<string> {
  const res = await exportLedger(new NextRequest(url));
  expect(res.status).toBe(200);
  expect(res.headers.get("Content-Type")).toBe("application/pdf");
  const parser = new PDFParse({ data: Buffer.from(await res.arrayBuffer()) });
  const { text } = await parser.getText();
  await parser.destroy();
  // Money cells join code and figure with a non-breaking space (nowrap);
  // normalize so assertions read naturally.
  return text.replace(/\u00A0/g, " ");
}

describe("company ledger export", () => {
  it("lists every transaction chronologically with running balances and a closing that equals total outstanding", async () => {
    const text = await ledgerText("http://localhost/api/admin/transactions/ledger");

    // Opening row first — before any payment row (the reported bug had the
    // opening row sorting after backdated payments).
    const openingIdx = text.indexOf("Opening balance");
    expect(openingIdx).toBeGreaterThan(-1);
    expect(openingIdx).toBeLessThan(text.indexOf("PAY-2026-00013"));

    // Credits in chronological order: 04 Sep, 05 Sep, 20 Sep.
    const b1 = text.indexOf("PAY-2026-00013");
    const a1 = text.indexOf("PAY-2026-00011");
    const a2 = text.indexOf("PAY-2026-00012");
    expect(b1).toBeGreaterThan(-1);
    expect(b1).toBeLessThan(a1);
    expect(a1).toBeLessThan(a2);

    // Credit rows carry PAY + receipt refs.
    expect(text).toContain("RCT-2026-00013");

    // Running balances: after B1's 3M credit the company holds
    // 10M + 8M − 3M = 15M; after A1's 4M credit, 11M.
    expect(text).toContain("NGN 15,000,000");
    expect(text).toContain("NGN 11,000,000");

    // Installment balances: B1 owes 5M after its payment; A2 owes 5M.
    expect(text).toContain("NGN 5,000,000");

    // Closing company balance = total outstanding (0 + 5M + 5M).
    expect(text).toContain("NGN 10,000,000");
    expect(text).toContain("Totals");
    // Running balances never go negative from ordering errors.
    expect(text).not.toContain("NGN -");
    // Totals row: 23M debited, 13M credited.
    expect(text).toContain("NGN 23,000,000");
    expect(text).toContain("NGN 13,000,000");
  }, 30000);

  it("a date range compresses earlier rows into a brought-forward opening balance", async () => {
    const text = await ledgerText("http://localhost/api/admin/transactions/ledger?from=2026-09-04");

    // Pre-period: 18M debited, nothing credited → opening 18M.
    expect(text).toContain("NGN 18,000,000");
    // Pre-period debit rows are compressed into the opening (their credit
    // rows still show the TXN ref, so assert on the sale dates instead).
    expect(text).not.toContain("01 Sept 2026");
    expect(text).not.toContain("03 Sept 2026");
    // …but their payments still count toward installment balances.
    expect(text).toContain("PAY-2026-00012");
    // Same closing: the period runs to the end of the data.
    expect(text).toContain("NGN 10,000,000");
  }, 30000);
});
