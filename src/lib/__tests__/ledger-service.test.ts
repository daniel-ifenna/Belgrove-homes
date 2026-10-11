import { describe, it, expect, vi } from "vitest";
import {
  planAllocation,
  planAllocationCapped,
  previewAllocation,
  postLedgerEntry,
  postPaymentEntry,
  postAllocations,
  getLedgerBalances,
  verifyTransactionLedger,
  LedgerError,
  type TxClient,
} from "../finance/ledger";

const INST = (id: string, n: number, scheduled: number, paid = 0) => ({
  id,
  installmentNumber: n,
  scheduledAmount: scheduled,
  paidAmount: paid,
});

describe("planAllocation (waterfall)", () => {
  const schedule = [INST("i0", 0, 9_250_000), INST("i1", 1, 3_083_333), INST("i2", 2, 3_083_333)];

  it("exact installment payment fills one row", () => {
    expect(planAllocation(schedule, "i0", 9_250_000)).toEqual([{ installmentId: "i0", amount: 9_250_000 }]);
  });

  it("partial payment part-clears one row", () => {
    expect(planAllocation(schedule, "i0", 300_000)).toEqual([{ installmentId: "i0", amount: 300_000 }]);
  });

  it("lump sum clears several installments (sums exactly to the payment)", () => {
    const plan = planAllocation(schedule, "i0", 12_000_000);
    expect(plan).toEqual([
      { installmentId: "i0", amount: 9_250_000 },
      { installmentId: "i1", amount: 2_750_000 },
    ]);
    expect(plan.reduce((s, p) => s + p.amount, 0)).toBe(12_000_000);
  });

  it("early payment pre-fills future installments (starts at targeted row)", () => {
    const plan = planAllocation(schedule, "i1", 3_083_333);
    expect(plan).toEqual([{ installmentId: "i1", amount: 3_083_333 }]);
  });

  it("skips full rows and continues forward", () => {
    const paid = [INST("i0", 0, 9_250_000, 9_250_000), INST("i1", 1, 3_083_333), INST("i2", 2, 3_083_333)];
    expect(planAllocation(paid, "i0", 1_000_000)).toEqual([{ installmentId: "i1", amount: 1_000_000 }]);
  });

  it("rejects over-schedule amounts without writing anything (caller must reject)", () => {
    expect(() => planAllocation(schedule, "i0", 99_000_000)).toThrow(LedgerError);
  });

  it("rejects non-positive and non-integer amounts", () => {
    expect(() => planAllocation(schedule, "i0", 0)).toThrow(LedgerError);
    expect(() => planAllocation(schedule, "i0", 10.5)).toThrow(LedgerError);
  });

  it("awkward totals split without drift (floor + remainder on last)", () => {
    // 18.5M @50% + 3 monthlies: 9.25M + 3×3,083,333 + 1 remainder on last.
    const awkward = [INST("i0", 0, 9_250_000), INST("i1", 1, 3_083_333), INST("i2", 2, 3_083_333), INST("i3", 3, 3_083_334)];
    const plan = planAllocation(awkward, "i0", 18_500_000);
    expect(plan.reduce((s, p) => s + p.amount, 0)).toBe(18_500_000);
    expect(plan[plan.length - 1]).toEqual({ installmentId: "i3", amount: 3_083_334 });
  });

  it("capped variant parks the excess as remainder instead of throwing", () => {
    const { plan, remainder } = planAllocationCapped(schedule, "i0", 20_000_000);
    expect(plan.reduce((s, p) => s + p.amount, 0)).toBe(15_416_666);
    expect(remainder).toBe(4_583_334);
  });
});

function memDb() {
  const state = { entries: [] as Record<string, unknown>[], allocs: [] as Record<string, unknown>[] };
  const tx = {
    ledgerEntry: {
      create: async (args: { data: Record<string, unknown> }) => {
        if (!args.data.idempotencyKey) throw new Error("key required");
        if (state.entries.some((e) => e.idempotencyKey === args.data.idempotencyKey)) {
          throw Object.assign(new Error("Unique constraint"), { code: "P2002" });
        }
        const row = { id: `le-${state.entries.length + 1}`, ...args.data };
        state.entries.push(row);
        return row;
      },
      findMany: async (args: { where: { transactionId?: string; type?: string } }) =>
        state.entries.filter(
          (e) =>
            (!args.where.transactionId || e.transactionId === args.where.transactionId) &&
            (!args.where.type || e.type === args.where.type)
        ),
    },
    paymentAllocation: {
      create: async (args: { data: Record<string, unknown> }) => {
        const row = { id: `pa-${state.allocs.length + 1}`, ...args.data };
        state.allocs.push(row);
        return row;
      },
      findMany: async (args: { where: { paymentId?: string; payment?: { transactionId: string } } }) =>
        state.allocs.filter(
          (a) => !args.where.paymentId || a.paymentId === args.where.paymentId
        ),
    },
  } as unknown as TxClient;
  return { tx, state };
}

describe("previewAllocation (record-form preview)", () => {
  const labeled = [
    { ...INST("i0", 0, 9_250_000), label: "Initial payment" },
    { ...INST("i1", 1, 3_083_333), label: "Month 1" },
    { ...INST("i2", 2, 3_083_333), label: "Month 2" },
  ];

  it("describes clears / part-pays lines and the balance after", () => {
    const p = previewAllocation(labeled, 12_000_000, 15_416_666, 0);
    expect(p.lines).toEqual([
      { installmentId: "i0", label: "Initial payment", clears: true, applied: 9_250_000, scheduled: 9_250_000 },
      { installmentId: "i1", label: "Month 1", clears: false, applied: 2_750_000, scheduled: 3_083_333 },
    ]);
    expect(p.remainder).toBe(0);
    expect(p.balanceAfter).toBe(3_416_666);
  });

  it("reports excess as remainder (credit) with a negative balance after", () => {
    const p = previewAllocation(labeled, 20_000_000, 15_416_666, 0);
    expect(p.lines).toHaveLength(3);
    expect(p.remainder).toBe(4_583_334);
    expect(p.balanceAfter).toBe(-4_583_334);
  });
});

describe("postLedgerEntry validation", () => {  it("rejects unknown types and non-positive amounts before touching the db", async () => {
    const { tx } = memDb();
    const create = vi.spyOn(tx.ledgerEntry, "create");
    await expect(
      postLedgerEntry(tx, {
        transactionId: "t1", type: "NOPE" as never, amount: 100, direction: "DEBIT",
        effectiveDate: new Date(), idempotencyKey: "k1",
      })
    ).rejects.toThrow(LedgerError);
    await expect(
      postLedgerEntry(tx, {
        transactionId: "t1", type: "PAYMENT", amount: 0, direction: "CREDIT",
        effectiveDate: new Date(), idempotencyKey: "k2",
      })
    ).rejects.toThrow(LedgerError);
    await expect(
      postLedgerEntry(tx, {
        transactionId: "t1", type: "PAYMENT", amount: 100, direction: "CREDIT",
        effectiveDate: new Date(), idempotencyKey: "",
      })
    ).rejects.toThrow(LedgerError);
    expect(create).not.toHaveBeenCalled();
  });

  it("postPaymentEntry defaults the key to payment:{id} and posts a CREDIT", async () => {
    const { tx, state } = memDb();
    await postPaymentEntry(tx, { transactionId: "t1", paymentId: "p1", amount: 500, effectiveDate: new Date("2026-01-02") });
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]).toMatchObject({ type: "PAYMENT", direction: "CREDIT", amount: 500, paymentId: "p1", idempotencyKey: "payment:p1" });
  });
});

describe("getLedgerBalances invariants", () => {
  it("totalPayable = charges − discounts; totalPaid = payments − reversals", async () => {
    const { tx } = memDb();
    const d = new Date("2026-01-01");
    const key = (s: string) => ({ transactionId: "t1", effectiveDate: d, idempotencyKey: s });
    await postLedgerEntry(tx, { ...key("c1"), type: "CHARGE_BASE", amount: 18_500_000, direction: "DEBIT" });
    await postLedgerEntry(tx, { ...key("d1"), type: "DISCOUNT", amount: 500_000, direction: "CREDIT" });
    await postLedgerEntry(tx, { ...key("p1"), type: "PAYMENT", amount: 3_000_000, direction: "CREDIT", paymentId: "pay-1" });
    await postLedgerEntry(tx, { ...key("r1"), type: "REVERSAL", amount: 3_000_000, direction: "DEBIT" });
    const b = await getLedgerBalances(tx, "t1");
    expect(b).toMatchObject({
      chargeTotal: 18_500_000,
      discountTotal: 500_000,
      paymentTotal: 3_000_000,
      reversalTotal: 3_000_000,
      totalPayable: 18_000_000,
      totalPaid: 0,
      outstanding: 18_000_000,
      entryCount: 4,
    });
  });
});

describe("verifyTransactionLedger", () => {
  function fullDb() {
    const { tx, state } = memDb();
    const txn = {
      id: "t1", ref: "TXN-1", totalPayable: 10_000_000, totalPaid: 4_000_000, outstandingBalance: 6_000_000,
      installments: [
        { id: "i0", installmentNumber: 0, paidAmount: 4_000_000 },
        { id: "i1", installmentNumber: 1, paidAmount: 0 },
      ],
    };
    const payments = [{ id: "p1", paymentReference: "PAY-1", amount: 4_000_000 }];
    const db = {
      ...tx,
      transaction: { findUnique: async () => txn },
      payment: { findMany: async () => payments },
      paymentAllocation: {
        ...tx.paymentAllocation,
        findMany: async (args: { where: { paymentId?: string; payment?: { transactionId: string } } }) => {
          const rows = state.allocs as { paymentId: string; installmentId: string; amount: number }[];
          if (args.where.paymentId) return rows.filter((r) => r.paymentId === args.where.paymentId);
          return rows;
        },
      },
    } as unknown as TxClient;
    return { db, state };
  }

  it("passes when entries, allocations and stored columns agree", async () => {
    const { db } = fullDb();
    const d = new Date("2026-01-01");
    await postLedgerEntry(db, { transactionId: "t1", type: "CHARGE_BASE", amount: 10_000_000, direction: "DEBIT", effectiveDate: d, idempotencyKey: "c1" });
    await postPaymentEntry(db, { transactionId: "t1", paymentId: "p1", amount: 4_000_000, effectiveDate: d });
    await postAllocations(db, "p1", [{ installmentId: "i0", amount: 4_000_000 }]);
    const check = await verifyTransactionLedger(db, "t1");
    expect(check.ok).toBe(true);
    expect(check.problems).toEqual([]);
  });

  it("reports every divergence class", async () => {
    const { db } = fullDb();
    const d = new Date("2026-01-01");
    // Charge short by 1M, payment entry missing, allocation short.
    await postLedgerEntry(db, { transactionId: "t1", type: "CHARGE_BASE", amount: 9_000_000, direction: "DEBIT", effectiveDate: d, idempotencyKey: "c1" });
    const check = await verifyTransactionLedger(db, "t1");
    expect(check.ok).toBe(false);
    expect(check.problems.join("\n")).toMatch(/totalPayable/);
    expect(check.problems.join("\n")).toMatch(/no PAYMENT ledger entry/);
  });

  it("credit payments verify as allocated + credit == amount", async () => {
    const { tx, state } = memDb();
    const d = new Date("2026-01-01");
    await postLedgerEntry(tx, { transactionId: "t1", type: "CHARGE_BASE", amount: 10_000_000, direction: "DEBIT", effectiveDate: d, idempotencyKey: "c1" });
    await postPaymentEntry(tx, { transactionId: "t1", paymentId: "p9", amount: 11_000_000, effectiveDate: d });
    await postAllocations(tx, "p9", [{ installmentId: "i0", amount: 10_000_000 }]);
    const db = {
      ...tx,
      transaction: {
        findUnique: async () => ({
          id: "t1", ref: "TXN-9", totalPayable: 10_000_000, totalPaid: 11_000_000, outstandingBalance: -1_000_000,
          installments: [{ id: "i0", installmentNumber: 0, paidAmount: 10_000_000 }],
        }),
      },
      payment: {
        findMany: async () => [{ id: "p9", paymentReference: "PAY-9", amount: 11_000_000, isCredit: true, creditAmount: 1_000_000 }],
      },
      paymentAllocation: {
        ...tx.paymentAllocation,
        findMany: async () => state.allocs,
      },
    } as unknown as TxClient;
    const check = await verifyTransactionLedger(db, "t1");
    expect(check.ok).toBe(true);
    expect(check.problems).toEqual([]);
  });
});
