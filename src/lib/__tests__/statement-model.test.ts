import { describe, it, expect } from "vitest";
import { buildStatementModel, toTitleCaseMethod } from "../statement-model";

const DAY = "2026-08-09T12:00:00.000Z";

function ledgerRow(over: Record<string, unknown>) {
  return {
    id: `e-${Math.random()}`,
    type: "PAYMENT",
    amount: 1_000_000,
    direction: "CREDIT",
    effectiveDate: new Date(DAY),
    createdAt: new Date(DAY),
    method: "Bank Transfer",
    bankReference: null,
    paymentId: null,
    reversesEntryId: null,
    note: null,
    payment: null,
    ...over,
  };
}

function fakeDb(opts: {
  txn?: Record<string, unknown>;
  ledger?: Record<string, unknown>[];
  receipts?: { paymentId: string; ref: string }[];
  payments?: { id: string; status: string; paymentDate: Date; verificationNote: string | null; isCredit: boolean }[];
}) {
  const txn = {
    id: "t1",
    ref: "TXN-2026-62831",
    customerName: "Valentine Nzube Onweluzo",
    customerEmail: "v@x.com",
    customerPhone: "+2348000000000",
    estate: "Sunrise Estate",
    unitType: "5-Bedroom Fully-Detached Duplex + BQ",
    plotCode: "SUN-P1-500SQM",
    plotQuantity: 1,
    contractDate: null,
    createdAt: new Date("2026-10-09T18:59:53.000Z"),
    ...(opts.txn ?? {}),
  };
  return {
    transaction: { findUnique: async () => txn },
    payment: { findMany: async () => opts.payments ?? [] },
    ledgerEntry: { findMany: async () => opts.ledger ?? [] },
    receipt: { findMany: async () => opts.receipts ?? [] },
  } as never;
}

const PAY = (id: string, date: string, verified = true) => ({
  id,
  status: "CONFIRMED",
  paymentDate: new Date(date),
  verificationNote: verified ? `Reconciled: bank line X by Ada at ${date}` : null,
  isCredit: false,
});

function corrected62831(verifiedAll = true) {
  const pays = [
    { id: "p1", date: "2026-08-09T12:00:00.000Z", ref: "262220980712", rc: "RCT-2026-79860" },
    { id: "p2", date: "2026-08-12T12:00:00.000Z", ref: "262240986795", rc: "RCT-2026-31207" },
    { id: "p3", date: "2026-08-19T12:00:00.000Z", ref: "2623210148410", rc: "RCT-2026-83436" },
    { id: "p4", date: "2026-09-24T12:00:00.000Z", ref: null, rc: "RCT-2026-45918" },
  ];
  return {
    ledger: [
      ledgerRow({ id: "c", type: "CHARGE_BASE", amount: 18_500_000, direction: "DEBIT", effectiveDate: new Date("2026-10-09T18:59:53.000Z"), createdAt: new Date("2026-10-09T18:59:53.000Z") }),
      ...pays.map((p, i) =>
        ledgerRow({ id: `e-p${i}`, amount: 3_000_000, effectiveDate: new Date(p.date), createdAt: new Date("2026-10-09T19:00:00.000Z"), bankReference: p.ref, paymentId: p.id, payment: { paymentReference: `PAY-${i}` } })
      ),
    ],
    receipts: pays.map((p) => ({ paymentId: p.id, ref: p.rc })),
    payments: pays.map((p, i) => PAY(p.id, p.date, verifiedAll || i !== 1)),
  };
}

describe("toTitleCaseMethod", () => {
  it("normalises without touching canonical values", () => {
    expect(toTitleCaseMethod("Bank Transfer")).toBe("Bank Transfer");
    expect(toTitleCaseMethod("bank transfer")).toBe("Bank Transfer");
    expect(toTitleCaseMethod("BANK TRANSFER")).toBe("Bank Transfer");
    expect(toTitleCaseMethod(null)).toBe("Bank Transfer");
  });
});

describe("buildStatementModel — corrected TXN-2026-62831 (primary fixture)", () => {
  it("produces the spec's rows and balances with the earliest-payment fallback", async () => {
    const f = corrected62831();
    const m = await buildStatementModel(fakeDb(f), { transactionId: "t1", draft: true });
    expect(m.contractAssumed).toBe(true);
    expect(m.contractDate).toBe("09-08-2026");
    expect(m.dataCheckErrors).toEqual([]);
    expect(m.rows.map((r) => r.balance)).toEqual([18_500_000, 15_500_000, 12_500_000, 9_500_000, 6_500_000]);
    expect(m.rows[0]).toMatchObject({ date: "09-08-2026", line1: "Contract price", line2: "Sunrise Estate, SUN-P1-500SQM", charge: 18_500_000 });
    expect(m.rows[4]).toMatchObject({ date: "24-09-2026", line1: "Payment received, Bank Transfer", line2: "Receipt RCT-2026-45918", payment: 3_000_000 });
    expect(m.totals).toEqual({ charges: 18_500_000, payments: 12_000_000 });
    expect(m.summary).toEqual({ contractPrice: 18_500_000, totalPaid: 12_000_000, outstanding: 6_500_000 });
    expect(m.closing).toEqual({ balance: 6_500_000, settled: false, credit: false });
    expect(m.layoutVersion).toBe("stmt-v1");
    expect(m.isDraft).toBe(true);
    expect(m.number).toBeUndefined();
  });

  it("warns on assumed date and unmatched bank ticks, without failing invariants", async () => {
    const f = corrected62831(false);
    const m = await buildStatementModel(fakeDb(f), { transactionId: "t1", draft: true });
    expect(m.dataCheckErrors).toEqual([]);
    expect(m.warnings.join(" | ")).toContain("assumed");
    expect(m.warnings.join(" | ")).toContain("1 payment not ticked");
  });
});

describe("edge fixtures", () => {
  it("settled outright account reads Account settled", async () => {
    const m = await buildStatementModel(
      fakeDb({
        ledger: [
          ledgerRow({ id: "c", type: "CHARGE_BASE", amount: 5_800_000, direction: "DEBIT" }),
          ledgerRow({ id: "p", amount: 5_800_000, paymentId: "p", payment: { paymentReference: "PAY-1" } }),
        ],
        receipts: [{ paymentId: "p", ref: "RCT-1" }],
        payments: [PAY("p", DAY)],
      }),
      { transactionId: "t1", draft: false, number: "STM-2026-00001" }
    );
    expect(m.closing).toEqual({ balance: 0, settled: true, credit: false });
    expect(m.summary.outstanding).toBe(0);
    expect(m.number).toBe("STM-2026-00001");
  });

  it("no payments: charge only, outstanding equals price", async () => {
    const m = await buildStatementModel(
      fakeDb({ ledger: [ledgerRow({ id: "c", type: "CHARGE_BASE", amount: 18_500_000, direction: "DEBIT" })] }),
      { transactionId: "t1", draft: true }
    );
    expect(m.rows).toHaveLength(1);
    expect(m.summary).toEqual({ contractPrice: 18_500_000, totalPaid: 0, outstanding: 18_500_000 });
  });

  it("discount nets the first summary cell", async () => {
    const m = await buildStatementModel(
      fakeDb({
        ledger: [
          ledgerRow({ id: "c", type: "CHARGE_BASE", amount: 18_500_000, direction: "DEBIT" }),
          ledgerRow({ id: "p", amount: 3_000_000, effectiveDate: new Date("2026-08-09T12:00:00.000Z"), paymentId: "p", payment: { paymentReference: "PAY-1" } }),
          ledgerRow({ id: "d", type: "DISCOUNT", amount: 500_000, direction: "CREDIT", effectiveDate: new Date("2026-09-01T12:00:00.000Z") }),
        ],
        payments: [PAY("p", "2026-08-09T12:00:00.000Z")],
      }),
      { transactionId: "t1", draft: true }
    );
    expect(m.rows[0].line1).toBe("Contract price");
    expect(m.rows[2]).toMatchObject({ line1: "Discount", charge: -500_000 });
    expect(m.summary.contractPrice).toBe(18_000_000);
    expect(m.dataCheckErrors).toEqual([]);
  });

  it("a row predating the assumed charge no longer blocks: the contract price opens", async () => {
    const m = await buildStatementModel(
      fakeDb({
        ledger: [
          ledgerRow({ id: "c", type: "CHARGE_BASE", amount: 18_500_000, direction: "DEBIT" }),
          ledgerRow({ id: "d", type: "DISCOUNT", amount: 500_000, direction: "CREDIT", effectiveDate: new Date("2026-08-09T12:00:00.000Z") }),
        ],
      }),
      { transactionId: "t1", draft: true }
    );
    // No payments: fallback is creation (Oct), so the August discount keeps
    // its real date — but the statement still opens with the contract price
    // instead of blocking. The assumed-date warning tells the admin to set
    // the real sale date.
    expect(m.rows[0]).toMatchObject({ line1: "Contract price" });
    expect(m.rows[1]).toMatchObject({ line1: "Discount", charge: -500_000, date: "09-08-2026" });
    expect(m.dataCheckErrors).toEqual([]);
    expect(m.warnings.join(" | ")).toContain("assumed");
  });

  it("a backdated payment before the explicit contract date follows the opening charge", async () => {
    const m = await buildStatementModel(
      fakeDb({
        txn: { contractDate: new Date("2026-10-01T12:00:00.000Z") },
        ledger: [
          ledgerRow({ id: "c", type: "CHARGE_BASE", amount: 4_000_000, direction: "DEBIT", effectiveDate: new Date("2026-10-01T12:00:00.000Z") }),
          ledgerRow({ id: "p", amount: 1_000_000, effectiveDate: new Date("2026-08-15T12:00:00.000Z"), paymentId: "p", payment: { paymentReference: "PAY-1" } }),
        ],
        receipts: [{ paymentId: "p", ref: "RCT-1" }],
        payments: [PAY("p", "2026-08-15T12:00:00.000Z")],
      }),
      { transactionId: "t1", draft: true }
    );
    expect(m.contractAssumed).toBe(false);
    expect(m.rows.map((r) => r.line1)).toEqual(["Contract price", "Payment received, Bank Transfer"]);
    expect(m.rows[0].date).toBe("01-10-2026");
    expect(m.rows[1].date).toBe("15-08-2026");
    expect(m.rows.map((r) => r.balance)).toEqual([4_000_000, 3_000_000]);
    expect(m.dataCheckErrors).toEqual([]);
  });

  it("a pending backdated payment dates the assumed contract date", async () => {
    const m = await buildStatementModel(
      fakeDb({
        ledger: [
          ledgerRow({ id: "c", type: "CHARGE_BASE", amount: 4_000_000, direction: "DEBIT" }),
        ],
        payments: [
          { id: "pend", status: "PENDING_VERIFICATION", paymentDate: new Date("2026-08-15T12:00:00.000Z"), verificationNote: null, isCredit: false },
        ],
      }),
      { transactionId: "t1", draft: true }
    );
    // The pending payment never prints — it only dates the opening charge.
    expect(m.contractAssumed).toBe(true);
    expect(m.contractDate).toBe("15-08-2026");
    expect(m.rows).toHaveLength(1);
    expect(m.rows[0]).toMatchObject({ line1: "Contract price", date: "15-08-2026" });
    expect(m.dataCheckErrors).toEqual([]);
    expect(m.warnings.join(" | ")).toContain("awaiting verification");
  });

  it("genuinely missing charges still block generation", async () => {
    const m = await buildStatementModel(
      fakeDb({
        ledger: [
          ledgerRow({ id: "p", amount: 1_000_000, paymentId: "p", payment: { paymentReference: "PAY-1" } }),
        ],
        payments: [{ id: "p", status: "CONFIRMED", paymentDate: new Date(DAY), verificationNote: "Reconciled: x", isCredit: true }],
      }),
      { transactionId: "t1", draft: true }
    );
    expect(m.dataCheckErrors.join(" ")).toContain("First row is not the contract price charge");
  });

  it("refund and explicit credit balance", async () => {
    const m = await buildStatementModel(
      fakeDb({
        ledger: [
          ledgerRow({ id: "c", type: "CHARGE_BASE", amount: 5_000_000, direction: "DEBIT" }),
          ledgerRow({ id: "p", amount: 5_000_000, paymentId: "p", payment: { paymentReference: "PAY-1" } }),
          ledgerRow({ id: "r", type: "REFUND", amount: 1_000_000, direction: "DEBIT", method: "Cash", paymentId: "r" }),
        ],
        payments: [
          PAY("p", DAY),
          { id: "r", status: "CONFIRMED", paymentDate: new Date(DAY), verificationNote: "Reconciled: x", isCredit: true },
        ],
      }),
      { transactionId: "t1", draft: true }
    );
    const refund = m.rows.find((r) => r.line1.startsWith("Refund"));
    expect(refund).toMatchObject({ payment: -1_000_000 });
    expect(m.closing).toEqual({ balance: 1_000_000 - 0 - 0 + 0, settled: false, credit: false });
    expect(m.dataCheckErrors).toEqual([]);
  });

  it("excludes reversed entries and their reversals, ignores pending", async () => {
    const m = await buildStatementModel(
      fakeDb({
        ledger: [
          ledgerRow({ id: "c", type: "CHARGE_BASE", amount: 10_000_000, direction: "DEBIT" }),
          ledgerRow({ id: "old", amount: 2_000_000, paymentId: "old", payment: { paymentReference: "PAY-0" } }),
          ledgerRow({ id: "rev", type: "REVERSAL", amount: 2_000_000, direction: "DEBIT", reversesEntryId: "old" }),
          ledgerRow({ id: "new", amount: 2_000_000, paymentId: "new", payment: { paymentReference: "PAY-1" } }),
        ],
        receipts: [{ paymentId: "new", ref: "RCT-NEW" }],
        payments: [
          { id: "old", status: "CANCELLED", paymentDate: new Date(DAY), verificationNote: null, isCredit: false },
          PAY("new", DAY),
          { id: "pend", status: "PENDING_VERIFICATION", paymentDate: new Date(DAY), verificationNote: null, isCredit: false },
        ],
      }),
      { transactionId: "t1", draft: true }
    );
    expect(m.rows.map((r) => r.line1)).toEqual(["Contract price", "Payment received, Bank Transfer"]);
    expect(m.summary.totalPaid).toBe(2_000_000);
    expect(m.warnings.join(" | ")).toContain("awaiting verification");
  });

  it("flags negative balances with no credit and blocks generate", async () => {
    const m = await buildStatementModel(
      fakeDb({
        ledger: [
          ledgerRow({ id: "c", type: "CHARGE_BASE", amount: 5_000_000, direction: "DEBIT" }),
          ledgerRow({ id: "p", amount: 8_000_000, paymentId: "p", payment: { paymentReference: "PAY-1" } }),
        ],
        payments: [PAY("p", DAY)],
      }),
      { transactionId: "t1", draft: true }
    );
    expect(m.dataCheckErrors.length).toBeGreaterThan(0);
    expect(m.dataCheckErrors.join(" ")).toContain("negative");
  });

  it("holds 31 Aug and midnight instants", async () => {
    const m = await buildStatementModel(
      fakeDb({
        ledger: [
          ledgerRow({ id: "c", type: "CHARGE_BASE", amount: 1_000_000, direction: "DEBIT" }),
          ledgerRow({ id: "p", amount: 1_000_000, effectiveDate: new Date("2026-08-31T12:00:00.000Z"), paymentId: "p", payment: { paymentReference: "PAY-1" } }),
        ],
        payments: [PAY("p", "2026-08-31T12:00:00.000Z")],
      }),
      { transactionId: "t1", draft: true }
    );
    expect(m.rows[1].date).toBe("31-08-2026");
  });

  it("same-day charge (noon) sorts before payment (midnight): TXN-2026-87153", async () => {
    // The payment is stored date-only (midnight) while the charge carries a
    // noon instant on the same calendar day. Calendar-day ordering must tie
    // them so type priority (charge first) decides — full-timestamp ordering
    // put the payment first and drove the balance negative.
    const m = await buildStatementModel(
      fakeDb({
        txn: { contractDate: new Date("2026-10-08T12:00:00.000Z") },
        ledger: [
          ledgerRow({ id: "c", type: "CHARGE_BASE", amount: 4_950_000, direction: "DEBIT", effectiveDate: new Date("2026-10-08T12:00:00.000Z"), createdAt: new Date("2026-10-12T02:16:15.000Z") }),
          ledgerRow({ id: "i", type: "CHARGE_INTEREST", amount: 247_500, direction: "DEBIT", effectiveDate: new Date("2026-10-08T12:00:00.000Z"), createdAt: new Date("2026-10-12T02:16:16.000Z") }),
          ledgerRow({ id: "p", amount: 2_598_750, effectiveDate: new Date("2026-10-08T00:00:00.000Z"), createdAt: new Date("2026-10-12T02:16:16.000Z"), paymentId: "p", payment: { paymentReference: "PAY-1" } }),
        ],
        payments: [PAY("p", "2026-10-08T00:00:00.000Z")],
      }),
      { transactionId: "t1", draft: true }
    );
    expect(m.contractAssumed).toBe(false);
    expect(m.rows.map((r) => r.line1)).toEqual([
      "Contract price",
      "Interest (one-time charge)",
      "Payment received, Bank Transfer",
    ]);
    expect(m.rows.map((r) => r.balance)).toEqual([4_950_000, 5_197_500, 2_598_750]);
    expect(m.dataCheckErrors).toEqual([]);
  });
});
