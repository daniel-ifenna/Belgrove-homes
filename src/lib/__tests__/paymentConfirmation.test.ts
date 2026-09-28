import { describe, it, expect } from "vitest";
import {
  deriveInstallmentStatus,
  wouldExceedSchedule,
  applyConfirmationDbUnit,
  reverseConfirmedPaymentDbUnit,
  toUserFacingError,
  PaymentAlreadyHandledError,
  OverScheduleError,
  type TxClient,
} from "../paymentConfirmation";

// ---- In-memory mock of the tx client (stateful, so race/idempotency hold) ----

type MockPayment = {
  id: string;
  transactionId: string;
  status: string;
  amount: number;
  paymentDate: Date;
  paymentMethod: string | null;
  installmentId: string | null;
  confirmedAt?: Date | null;
  confirmedById?: string | null;
  verificationNotes?: string | null;
  updatedAt?: Date;
};

type MockInstallment = {
  id: string;
  transactionId: string;
  installmentNumber: number;
  type: string;
  dueDate: Date;
  scheduledAmount: number;
  paidAmount: number;
  status: string;
};

type MockTransaction = {
  id: string;
  ref: string;
  bookingId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  estate: string;
  unitType: string | null;
  plotCode: string | null;
  sqm: number | null;
  baseAmount: number;
  unitPrice: number;
  plotQuantity: number;
  interestAmount: number;
  totalPayable: number;
  totalPaid: number;
  outstandingBalance: number;
  status: string;
  paymentPlan: { code: string; name: string } | null;
  installments: MockInstallment[];
};

type MockState = {
  payments: MockPayment[];
  installments: MockInstallment[];
  transactions: MockTransaction[];
  receipts: Record<string, unknown>[];
};

function makeMockTx(state: MockState): TxClient {
  const findPayment = (id: string) => state.payments.find((p) => p.id === id) ?? null;
  const attachTransaction = (p: MockPayment) => {
    const t = state.transactions.find((t) => t.id === p.transactionId);
    if (!t) return null;
    return { ...p, transaction: t };
  };
  return {
    payment: {
      updateMany: async (args: unknown) => {
        const { where, data } = args as {
          where: { id: string; transactionId: string; status: string };
          data: Record<string, unknown>;
        };
        const p = state.payments.find(
          (x) => x.id === where.id && x.transactionId === where.transactionId && x.status === where.status
        );
        if (!p) return { count: 0 };
        Object.assign(p, data);
        return { count: 1 };
      },
      findUnique: async (args: unknown) => {
        const { where } = args as { where: { id: string } };
        const p = findPayment(where.id);
        return p ? attachTransaction(p) : null;
      },
      findMany: async (args: unknown) => {
        const { where } = args as { where: { transactionId: string; status: string } };
        return state.payments.filter((p) => p.transactionId === where.transactionId && p.status === where.status);
      },
      update: async (args: unknown) => {
        const { where, data } = args as { where: { id: string }; data: Record<string, unknown> };
        const p = findPayment(where.id);
        if (!p) throw new Error("not found");
        Object.assign(p, data);
        return p;
      },
    },
    installment: {
      findUnique: async (args: unknown) => {
        const { where } = args as { where: { id: string } };
        return state.installments.find((i) => i.id === where.id) ?? null;
      },
      update: async (args: unknown) => {
        const { where, data } = args as { where: { id: string }; data: Record<string, unknown> };
        const inst = state.installments.find((i) => i.id === where.id);
        if (!inst) throw new Error("not found");
        Object.assign(inst, data);
        return inst;
      },
      updateMany: async (args: unknown) => {
        const { where, data } = args as {
          where: { transactionId: string; status: { not: string } };
          data: Record<string, unknown>;
        };
        let count = 0;
        for (const inst of state.installments) {
          if (inst.transactionId === where.transactionId && inst.status !== where.status.not) {
            Object.assign(inst, data);
            count++;
          }
        }
        return { count };
      },
    },
    transaction: {
      findUnique: async (args: unknown) => {
        const { where } = args as { where: { id: string } };
        return state.transactions.find((t) => t.id === where.id) ?? null;
      },
      update: async (args: unknown) => {
        const { where, data } = args as { where: { id: string }; data: Record<string, unknown> };
        const t = state.transactions.find((x) => x.id === where.id);
        if (!t) throw new Error("not found");
        Object.assign(t, data);
        return t;
      },
    },
    receipt: {
      create: async (args: unknown) => {
        const { data } = args as { data: Record<string, unknown> };
        const row = { id: `rcpt-${state.receipts.length + 1}`, ...data };
        state.receipts.push(row);
        return row;
      },
    },
  } as unknown as TxClient;
}

function seed2900(): MockState {
  const installment: MockInstallment = {
    id: "inst-0",
    transactionId: "txn-1",
    installmentNumber: 0,
    type: "INITIAL",
    dueDate: new Date("2026-01-01T00:00:00Z"),
    scheduledAmount: 2_900_000,
    paidAmount: 0,
    status: "DUE",
  };
  const transaction: MockTransaction = {
    id: "txn-1",
    ref: "TXN-2026-00001",
    bookingId: null,
    customerName: "Test Client",
    customerEmail: "test@example.com",
    customerPhone: null,
    estate: "Test Estate",
    unitType: "Plot",
    plotCode: "TST-200",
    sqm: 200,
    baseAmount: 2_900_000,
    unitPrice: 2_900_000,
    plotQuantity: 1,
    interestAmount: 0,
    totalPayable: 2_900_000,
    totalPaid: 0,
    outstandingBalance: 2_900_000,
    status: "ACTIVE",
    paymentPlan: { code: "OUTRIGHT", name: "Outright" },
    installments: [installment],
  };
  return { payments: [], installments: [installment], transactions: [transaction], receipts: [] };
}

function pendingPayment(id: string): MockPayment {
  return {
    id,
    transactionId: "txn-1",
    status: "PENDING_VERIFICATION",
    amount: 2_900_000,
    paymentDate: new Date("2026-02-01T00:00:00Z"),
    paymentMethod: "Bank Transfer",
    installmentId: "inst-0",
  };
}

const REF_BASE = {
  receiptRef: "BEL-2026-00001",
  receiptUrl: "https://example.com/r/test-access-token-00001",
  qrTargetUrl: "https://example.com/r/test-access-token-00001",
  pdfPath: "storage/receipts/BEL-2026-00001.pdf",
  accessToken: "test-access-token-00001",
};

describe("deriveInstallmentStatus", () => {
  const past = new Date("2026-01-01T00:00:00Z");
  const future = new Date("2027-01-01T00:00:00Z");
  const now = new Date("2026-06-01T00:00:00Z");

  it("is Paid only when confirmed money covers the schedule", () => {
    expect(deriveInstallmentStatus(2_900_000, 2_900_000, past, now)).toBe("PAID");
  });

  it("is Late when past due and confirmed paid < scheduled (pending counts as nothing)", () => {
    // A pending ₦2.9M must NOT move this off Late — only confirmed 0 counts.
    expect(deriveInstallmentStatus(0, 2_900_000, past, now)).toBe("OVERDUE");
    expect(deriveInstallmentStatus(1_000_000, 2_900_000, past, now)).toBe("OVERDUE");
  });

  it("is Partial when some confirmed money exists and due date is future", () => {
    expect(deriveInstallmentStatus(1_000_000, 2_900_000, future, now)).toBe("PARTIALLY_PAID");
  });

  it("is Due today, Pending for future dates", () => {
    expect(deriveInstallmentStatus(0, 2_900_000, now, now)).toBe("DUE");
    expect(deriveInstallmentStatus(0, 2_900_000, future, now)).toBe("PENDING");
  });
});

describe("wouldExceedSchedule", () => {
  it("rejects three identical pending payments against one installment (the reported bug)", () => {
    // First two pending (confirmed 0 + pending 2.9M... simulate sequentially):
    expect(wouldExceedSchedule(0, 0, 2_900_000, 2_900_000)).toBe(false); // 1st ok
    expect(wouldExceedSchedule(0, 2_900_000, 2_900_000, 2_900_000)).toBe(true); // 2nd rejected
    expect(wouldExceedSchedule(0, 5_800_000, 2_900_000, 2_900_000)).toBe(true); // 3rd rejected
  });

  it("allows exact fit and partials", () => {
    expect(wouldExceedSchedule(1_000_000, 0, 1_900_000, 2_900_000)).toBe(false);
    expect(wouldExceedSchedule(1_000_000, 0, 1_900_001, 2_900_000)).toBe(true);
  });
});

describe("applyConfirmationDbUnit", () => {
  it("confirms once: moves installment, totals, and creates exactly one receipt", async () => {
    const state = seed2900();
    state.payments.push(pendingPayment("pay-1"));
    const tx = makeMockTx(state);

    const result = await applyConfirmationDbUnit(tx, {
      paymentId: "pay-1",
      transactionId: "txn-1",
      ...REF_BASE,
    });

    expect(result.newTotalPaid).toBe(2_900_000);
    expect(result.newOutstanding).toBe(0);
    expect(result.isPaidInFull).toBe(true);
    expect(state.installments[0].status).toBe("PAID");
    expect(state.installments[0].paidAmount).toBe(2_900_000);
    expect(state.transactions[0].status).toBe("PAID_IN_FULL");
    expect(state.receipts).toHaveLength(1);
    expect((state.receipts[0] as { pdfStatus: string }).pdfStatus).toBe("PENDING");
    expect((state.receipts[0] as { paymentId: string }).paymentId).toBe("pay-1");
  });

  it("double-confirm applies only once (idempotent claim)", async () => {
    const state = seed2900();
    state.payments.push(pendingPayment("pay-1"));
    const tx = makeMockTx(state);

    await applyConfirmationDbUnit(tx, { paymentId: "pay-1", transactionId: "txn-1", ...REF_BASE });
    await expect(
      applyConfirmationDbUnit(tx, { paymentId: "pay-1", transactionId: "txn-1", ...REF_BASE })
    ).rejects.toBeInstanceOf(PaymentAlreadyHandledError);

    expect(state.transactions[0].totalPaid).toBe(2_900_000); // not doubled
    expect(state.receipts).toHaveLength(1); // no second receipt
  });

  it("rejects confirmation beyond the scheduled amount without moving anything", async () => {
    const state = seed2900();
    state.installments[0].paidAmount = 2_000_000;
    state.installments[0].status = "PARTIALLY_PAID";
    state.payments.push({ ...pendingPayment("pay-2"), amount: 1_500_000 });
    const tx = makeMockTx(state);

    await expect(
      applyConfirmationDbUnit(tx, { paymentId: "pay-2", transactionId: "txn-1", ...REF_BASE })
    ).rejects.toBeInstanceOf(OverScheduleError);

    // Nothing applied: no totals moved, no installment change, no receipt.
    // (In production the throw rolls back the whole transaction, including
    // the PENDING→CONFIRMED claim; the mock has no rollback, so only the
    // no-partial-write guarantees are asserted here.)
    expect(state.transactions[0].totalPaid).toBe(0);
    expect(state.installments[0].paidAmount).toBe(2_000_000);
    expect(state.receipts).toHaveLength(0);
  });
});

describe("reverseConfirmedPaymentDbUnit", () => {
  it("void reverses installment and totals, receipt stays for audit", async () => {
    const state = seed2900();
    state.payments.push({ ...pendingPayment("pay-1"), status: "CONFIRMED" });
    state.installments[0].paidAmount = 2_900_000;
    state.installments[0].status = "PAID";
    state.transactions[0].totalPaid = 2_900_000;
    state.transactions[0].outstandingBalance = 0;
    state.transactions[0].status = "PAID_IN_FULL";
    state.receipts.push({ id: "rcpt-1", paymentId: "pay-1" });
    const tx = makeMockTx(state);

    const result = await reverseConfirmedPaymentDbUnit(tx, {
      paymentId: "pay-1",
      transactionId: "txn-1",
      reason: "duplicate entry",
    });

    expect(result.newTotalPaid).toBe(0);
    expect(result.newOutstanding).toBe(2_900_000);
    expect(state.transactions[0].status).toBe("ACTIVE");
    expect(state.installments[0].paidAmount).toBe(0);
    expect(state.installments[0].status).toBe("OVERDUE"); // past due, nothing confirmed
    expect(state.payments[0].status).toBe("CANCELLED");
    expect(state.receipts).toHaveLength(1); // audit trail kept
  });

  it("second void aborts (already handled)", async () => {
    const state = seed2900();
    state.payments.push({ ...pendingPayment("pay-1"), status: "CONFIRMED" });
    state.installments[0].paidAmount = 2_900_000;
    state.installments[0].status = "PAID";
    state.transactions[0].totalPaid = 2_900_000;
    state.transactions[0].outstandingBalance = 0;
    const tx = makeMockTx(state);

    await reverseConfirmedPaymentDbUnit(tx, { paymentId: "pay-1", transactionId: "txn-1" });
    await expect(
      reverseConfirmedPaymentDbUnit(tx, { paymentId: "pay-1", transactionId: "txn-1" })
    ).rejects.toBeInstanceOf(PaymentAlreadyHandledError);
  });
});

describe("toUserFacingError", () => {
  it("maps the expired-transaction Prisma error to a friendly message with no internals", () => {
    const raw = new Error(
      "Transaction API error: A query cannot be executed on an expired transaction. The timeout for this transaction was 5000 ms, however 5590 ms passed..."
    );
    const msg = toUserFacingError(raw, "confirm");
    expect(msg).toBe("Couldn't confirm payment. Please try again.");
    expect(msg).not.toContain("Prisma");
    expect(msg).not.toContain("5000");
  });

  it("maps domain errors to actionable messages", () => {
    expect(toUserFacingError(new PaymentAlreadyHandledError("x"), "confirm")).toContain("already confirmed or voided");
    expect(toUserFacingError(new OverScheduleError(2_900_000, 2_900_000, 2_900_000), "confirm")).toContain(
      "scheduled amount"
    );
    expect(toUserFacingError({ code: "P2002" }, "record")).toContain("already recorded");
  });
});
