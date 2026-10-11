import { describe, it, expect } from "vitest";
import { getTransactionFinancials, type FinancialInstallmentInput } from "../finance";
import { startOfTodayLagos } from "../time";

// Fixed "today": 1 Oct 2026 (Lagos). Due dates around it exercise
// on-schedule / due-soon / overdue branches deterministically.
const NOW = startOfTodayLagos(new Date("2026-10-01T12:00:00Z"));

function inst(n: number, dueDate: string, scheduled: number, paid = 0): FinancialInstallmentInput {
  return {
    installmentNumber: n,
    type: n === 0 ? "INITIAL" : "MONTHLY",
    dueDate: new Date(dueDate),
    scheduledAmount: scheduled,
    confirmedPaid: paid,
  };
}

// Mirrors TXN-2026-41848: 19.4M payable, 9.7M initial paid, 3 monthlies open.
function txn41848() {
  return {
    totalPayable: 19_400_000,
    installments: [
      inst(0, "2026-09-30T11:15:52Z", 9_700_000, 9_700_000),
      inst(1, "2026-10-30T11:15:52Z", 3_233_333),
      inst(2, "2026-11-30T11:15:52Z", 3_233_333),
      inst(3, "2026-12-30T11:15:52Z", 3_233_334),
    ],
  };
}

describe("getTransactionFinancials", () => {
  it("partial payment: outstanding stays neutral with the next installment due", () => {
    const f = getTransactionFinancials(txn41848(), NOW);
    expect(f.totalPaid).toBe(9_700_000);
    expect(f.outstanding).toBe(9_700_000);
    expect(f.isFullyPaid).toBe(false);
    expect(f.isOverdue).toBe(false);
    expect(f.nextInstallment).toEqual({
      number: 1,
      type: "MONTHLY",
      amountDue: 3_233_333,
      dueDate: new Date("2026-10-30T11:15:52Z"),
    });
    expect(f.daysUntilDue).toBe(29);
    expect(f.daysOverdue).toBe(null);
    expect(f.overdueCount).toBe(0);
  });

  it("a payment exactly clearing an installment moves next-due forward", () => {
    const t = txn41848();
    t.installments[1].confirmedPaid = 3_233_333;
    const f = getTransactionFinancials(t, NOW);
    expect(f.nextInstallment?.number).toBe(2);
    expect(f.nextInstallment?.amountDue).toBe(3_233_333);
    expect(f.outstanding).toBe(9_700_000 - 3_233_333);
  });

  it("overpayment on one installment rolls into the next (carry-forward)", () => {
    const f = getTransactionFinancials(
      {
        totalPayable: 10_000_000,
        installments: [
          inst(0, "2026-09-01T00:00:00Z", 5_000_000, 7_000_000),
          inst(1, "2026-10-15T00:00:00Z", 5_000_000),
        ],
      },
      NOW
    );
    expect(f.totalPaid).toBe(7_000_000);
    expect(f.outstanding).toBe(3_000_000);
    // 2M excess covers part of installment 1.
    expect(f.nextInstallment).toMatchObject({ number: 1, amountDue: 3_000_000 });
    expect(f.isOverdue).toBe(false);
  });

  it("a past-due unpaid installment is overdue with day count", () => {
    const f = getTransactionFinancials(
      {
        totalPayable: 10_000_000,
        installments: [
          inst(0, "2026-09-01T00:00:00Z", 5_000_000, 5_000_000),
          inst(1, "2026-09-20T00:00:00Z", 5_000_000),
        ],
      },
      NOW
    );
    expect(f.isOverdue).toBe(true);
    expect(f.overdueCount).toBe(1);
    expect(f.daysOverdue).toBe(11);
    expect(f.daysUntilDue).toBe(null);
    expect(f.nextInstallment).toMatchObject({ number: 1, amountDue: 5_000_000 });
  });

  it("fully paid: no next installment, zero outstanding", () => {
    const t = txn41848();
    for (const i of t.installments) i.confirmedPaid = i.scheduledAmount;
    const f = getTransactionFinancials(t, NOW);
    expect(f.outstanding).toBe(0);
    expect(f.isFullyPaid).toBe(true);
    expect(f.nextInstallment).toBe(null);
    expect(f.isOverdue).toBe(false);
    expect(f.progressPct).toBe(100);
  });

  it("reversed payment restores outstanding and next-due", () => {
    const t = txn41848();
    t.installments[0].confirmedPaid = 0;
    const f = getTransactionFinancials(t, NOW);
    expect(f.outstanding).toBe(19_400_000);
    // Installment 0 was due 30 Sep → past due and unpaid: overdue.
    expect(f.isOverdue).toBe(true);
    expect(f.nextInstallment).toMatchObject({ number: 0, amountDue: 9_700_000 });
  });

  it("unlinked confirmed money covers the earliest dues first", () => {
    const f = getTransactionFinancials(
      {
        totalPayable: 10_000_000,
        unlinkedConfirmed: 5_000_000,
        installments: [inst(0, "2026-09-01T00:00:00Z", 5_000_000), inst(1, "2026-10-15T00:00:00Z", 5_000_000)],
      },
      NOW
    );
    expect(f.totalPaid).toBe(5_000_000);
    expect(f.nextInstallment).toMatchObject({ number: 1, amountDue: 5_000_000 });
    expect(f.isOverdue).toBe(false);
  });

  it("outright plan: single installment is the full balance due", () => {
    const f = getTransactionFinancials(
      { totalPayable: 2_900_000, installments: [inst(0, "2026-10-01T00:00:00Z", 2_900_000)] },
      NOW
    );
    expect(f.nextInstallment).toMatchObject({ number: 0, amountDue: 2_900_000 });
    expect(f.daysUntilDue).toBe(0);
    expect(f.isOverdue).toBe(false);
  });
});
