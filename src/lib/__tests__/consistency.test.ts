import { describe, it, expect } from "vitest";
import {
  getCollectedRevenue,
  getOverdueInstallments,
  getPendingVerification,
  getTransactionOverviews,
  getTransactionSummary,
  type FinanceDb,
} from "../finance";
import { getActionCounts, getActionItems, type InboxDb } from "../inbox";

// Phase 5 regression: one realistic seed, every surface. Dashboard cards,
// ledger totals, transaction summaries, inbox counts and sidebar badges must
// all agree with the finance service. Fully hermetic — no database.
const NOW = new Date("2026-09-28T12:00:00Z");
const SEPT = new Date("2026-09-01T00:00:00Z");

// ---- Seed ---------------------------------------------------------------
const TXNS = [
  { id: "t1", ref: "TXN-2026-00042", totalPayable: 8_700_000, customerName: "Adaeze Obi", isTest: false },
  { id: "tX", ref: "TXN-TEST-1", totalPayable: 20_000_000, customerName: "Test Fixture", isTest: true },
];

const INSTALLMENTS = [
  { id: "i0", transactionId: "t1", installmentNumber: 0, type: "INITIAL", dueDate: new Date("2026-08-05T00:00:00Z"), scheduledAmount: 2_900_000, status: "PAID" },
  { id: "i1", transactionId: "t1", installmentNumber: 1, type: "MONTHLY", dueDate: new Date("2026-09-05T00:00:00Z"), scheduledAmount: 2_900_000, status: "DUE" },
  { id: "i2", transactionId: "t1", installmentNumber: 2, type: "MONTHLY", dueDate: new Date("2026-10-05T00:00:00Z"), scheduledAmount: 2_900_000, status: "PENDING" },
  { id: "ix", transactionId: "tX", installmentNumber: 0, type: "INITIAL", dueDate: new Date("2026-09-05T00:00:00Z"), scheduledAmount: 20_000_000, status: "DUE" },
];

const PAYMENTS = [
  { id: "p1", amount: 2_900_000, paymentDate: new Date("2026-09-02T10:00:00Z"), createdAt: new Date("2026-09-02T10:00:00Z"), status: "CONFIRMED", installmentId: "i0", transactionId: "t1", paymentReference: "PAY-2026-00011" },
  { id: "p2", amount: 1_000_000, paymentDate: new Date("2026-09-10T10:00:00Z"), createdAt: new Date("2026-09-10T10:00:00Z"), status: "CONFIRMED", installmentId: "i1", transactionId: "t1", paymentReference: "PAY-2026-00012" },
  { id: "p3", amount: 1_900_000, paymentDate: new Date("2026-09-20T10:00:00Z"), createdAt: new Date("2026-09-20T10:00:00Z"), status: "PENDING_VERIFICATION", installmentId: "i1", transactionId: "t1", paymentReference: "PAY-2026-00013" },
  { id: "p4", amount: 500_000, paymentDate: new Date("2026-09-12T10:00:00Z"), createdAt: new Date("2026-09-12T10:00:00Z"), status: "CANCELLED", installmentId: "i1", transactionId: "t1", paymentReference: "PAY-2026-00014" },
  { id: "p5", amount: 5_000_000, paymentDate: new Date("2026-09-15T10:00:00Z"), createdAt: new Date("2026-09-15T10:00:00Z"), status: "CONFIRMED", installmentId: "ix", transactionId: "tX", paymentReference: "PAY-TEST-1" },
];

const OUTBOX = [
  { id: "o1", type: "receipt", status: "FAILED", relatedId: "r1", createdAt: new Date("2026-09-03T10:00:00Z"), updatedAt: new Date("2026-09-03T10:05:00Z") },
  { id: "o2", type: "receipt", status: "SENT", relatedId: "r1", createdAt: new Date("2026-09-03T11:00:00Z"), updatedAt: new Date("2026-09-03T11:00:00Z") },
];

const RECEIPTS = [{ id: "r1", ref: "RCT-2026-00007", customerName: "Adaeze Obi", finalAmount: 2_900_000 }];

const BOOKINGS = [
  { id: "b1", ref: "BKG-00001", name: "New Lead", location: "Kado", estate: null, status: "new", outcome: null as string | null, agentId: null as string | null, isTest: false, inspectedAt: null as Date | null, preferredDate: new Date("2026-10-02T09:00:00Z"), rescheduledDate: null as Date | null, transaction: null, createdAt: NOW, updatedAt: NOW },
  { id: "b2", ref: "BKG-00002", name: "Review Lead", location: "Kado", estate: null, status: "under_review", outcome: null, agentId: "a1", isTest: false, inspectedAt: null, preferredDate: new Date("2026-10-03T09:00:00Z"), rescheduledDate: null, transaction: null, createdAt: NOW, updatedAt: NOW },
  // preferredDate = real today so INSPECTION_DUE_TODAY is deterministic.
  { id: "b3", ref: "BKG-00003", name: "Approved Lead", location: "Guzape", estate: "Belgrove Peninsula", status: "approved", outcome: null, agentId: "a1", isTest: false, inspectedAt: null, preferredDate: new Date(), rescheduledDate: null, transaction: null, createdAt: NOW, updatedAt: NOW },
  { id: "b4", ref: "BKG-00004", name: "Inspected Lead", location: "Maitama", estate: null, status: "active", outcome: null, agentId: "a1", isTest: false, inspectedAt: new Date("2026-09-27T10:00:00Z"), preferredDate: new Date("2026-09-27T10:00:00Z"), rescheduledDate: null, transaction: null, createdAt: NOW, updatedAt: NOW },
  { id: "b5", ref: "BKG-00005", name: "Sold No Txn", location: "Asokoro", estate: "Belgrove Peninsula", status: "closed", outcome: "sold", agentId: "a1", isTest: false, inspectedAt: new Date("2026-09-20T10:00:00Z"), preferredDate: new Date("2026-09-20T10:00:00Z"), rescheduledDate: null, transaction: null, createdAt: NOW, updatedAt: NOW },
  { id: "b6", ref: "BKG-00006", name: "Adaeze Obi", location: "Guzape", estate: "Belgrove Peninsula", status: "closed", outcome: "sold", agentId: "a1", isTest: false, inspectedAt: new Date("2026-08-20T10:00:00Z"), preferredDate: new Date("2026-08-20T10:00:00Z"), rescheduledDate: null, transaction: { id: "t1" }, createdAt: NOW, updatedAt: NOW },
  { id: "b7", ref: "BKG-00007", name: "Lost Lead", location: "Kado", estate: null, status: "closed", outcome: "not_sold", agentId: "a1", isTest: false, inspectedAt: new Date("2026-09-21T10:00:00Z"), preferredDate: new Date("2026-09-21T10:00:00Z"), rescheduledDate: null, transaction: null, createdAt: NOW, updatedAt: NOW },
  { id: "b8", ref: "BKG-TEST-1", name: "Test Lead", location: "Kado", estate: null, status: "new", outcome: null, agentId: null, isTest: true, inspectedAt: null, preferredDate: new Date("2026-10-04T09:00:00Z"), rescheduledDate: null, transaction: null, createdAt: NOW, updatedAt: NOW },
];

// ---- Where-clause interpreter (covers exactly the operators used) -------
type Where = Record<string, unknown>;

function strEq(v: unknown, c: unknown): boolean {
  if (typeof c === "string") return v === c;
  if (c && typeof c === "object") {
    const o = c as Record<string, unknown>;
    if ("not" in o) return v !== o.not;
    if (Array.isArray(o.in)) return (o.in as unknown[]).includes(v);
    if (Array.isArray(o.notIn)) return !(o.notIn as unknown[]).includes(v);
  }
  return true;
}

function txnIsTest(id: string): boolean {
  return TXNS.find((t) => t.id === id)?.isTest ?? false;
}

function matchPayment(p: (typeof PAYMENTS)[number], w: Where): boolean {
  if ("status" in w && !strEq(p.status, w.status)) return false;
  if ("transactionId" in w && !strEq(p.transactionId, w.transactionId)) return false;
  if ("installmentId" in w && !strEq(p.installmentId, w.installmentId)) return false;
  const tx = w.transaction as { isTest?: boolean } | undefined;
  if (tx?.isTest === false && txnIsTest(p.transactionId)) return false;
  const pd = w.paymentDate as { gte?: Date; lte?: Date; lt?: Date } | undefined;
  if (pd?.gte && p.paymentDate < pd.gte) return false;
  if (pd?.lte && p.paymentDate > pd.lte) return false;
  if (pd?.lt && p.paymentDate >= pd.lt) return false;
  return true;
}

function matchInstallment(r: (typeof INSTALLMENTS)[number], w: Where): boolean {
  const tx = w.transaction as { isTest?: boolean } | undefined;
  if (tx?.isTest === false && txnIsTest(r.transactionId)) return false;
  const dd = w.dueDate as { lt?: Date } | undefined;
  if (dd?.lt && r.dueDate >= dd.lt) return false;
  if ("status" in w && !strEq(r.status, w.status)) return false;
  if ("transactionId" in w && !strEq(r.transactionId, w.transactionId)) return false;
  return true;
}

function matchBooking(b: (typeof BOOKINGS)[number], w: Where): boolean {
  if ("isTest" in w && (w.isTest as boolean) === false && b.isTest) return false;
  if ("status" in w && !strEq(b.status, w.status)) return false;
  if ("outcome" in w) {
    const o = w.outcome;
    if (o === null ? b.outcome !== null : b.outcome !== o) return false;
  }
  if ("agentId" in w && (w.agentId === null ? b.agentId !== null : b.agentId !== w.agentId)) return false;
  if ("transaction" in w && (w.transaction === null ? b.transaction !== null : false)) return false;
  if ("inspectedAt" in w) {
    const c = w.inspectedAt as { not: null };
    if (c?.not === null && b.inspectedAt === null) return false;
  }
  if ("id" in w && !strEq(b.id, w.id)) return false;
  return true;
}

function matchOutbox(o: (typeof OUTBOX)[number], w: Where): boolean {
  if ("type" in w && o.type !== w.type) return false;
  if ("status" in w && o.status !== w.status) return false;
  return true;
}

// ---- Fakes ---------------------------------------------------------------
const financeDb: FinanceDb = {
  payment: {
    aggregate: async (a: { where: Where }) => ({
      _sum: { amount: PAYMENTS.filter((p) => matchPayment(p, a.where)).reduce((s, p) => s + p.amount, 0) || null },
    }),
    count: async (a: { where: Where }) => PAYMENTS.filter((p) => matchPayment(p, a.where)).length,
    findMany: async (a: { where: Where }) => PAYMENTS.filter((p) => matchPayment(p, a.where ?? {})),
  },
  installment: {
    findMany: async (a: { where: Where }) => INSTALLMENTS.filter((r) => matchInstallment(r, a.where ?? {})),
  },
  transaction: {
    findMany: async () => TXNS.filter((t) => !t.isTest).map((t) => ({ id: t.id, totalPayable: t.totalPayable })),
    findUnique: async (a: { where: { id: string } }) => {
      const t = TXNS.find((x) => x.id === a.where.id);
      if (!t) return null;
      return {
        id: t.id,
        ref: t.ref,
        totalPayable: t.totalPayable,
        isTest: t.isTest,
        installments: INSTALLMENTS.filter((r) => r.transactionId === t.id),
      };
    },
  },
};

const inboxDb: InboxDb = {
  payment: {
    findMany: async (a: { where: Where }) =>
      PAYMENTS.filter((p) => matchPayment(p, a.where)).map((p) => ({
        ...p,
        transaction: (() => {
          const t = TXNS.find((x) => x.id === p.transactionId)!;
          return { id: t.id, ref: t.ref, customerName: t.customerName };
        })(),
      })),
    count: async (a: { where: Where }) => PAYMENTS.filter((p) => matchPayment(p, a.where)).length,
  },
  emailOutbox: {
    findMany: async (a: { where: Where }) => OUTBOX.filter((o) => matchOutbox(o, a.where)),
    count: async (a: { where: Where }) => OUTBOX.filter((o) => matchOutbox(o, a.where)).length,
  },
  receipt: {
    findMany: async (a: { where: { id?: { in?: string[] } } }) =>
      RECEIPTS.filter((r) => !a.where?.id?.in || a.where.id.in.includes(r.id)),
  },
  inspectionBooking: {
    findMany: async (a: { where: Where }) => BOOKINGS.filter((b) => matchBooking(b, a.where ?? {})),
    count: async (a: { where: Where }) => BOOKINGS.filter((b) => matchBooking(b, a.where)).length,
  },
  transaction: {
    findMany: async (a: { where: { id?: { in?: string[] } } }) =>
      TXNS.filter((t) => !a.where?.id?.in || a.where.id.in.includes(t.id)).map((t) => ({
        id: t.id,
        ref: t.ref,
        customerName: t.customerName,
      })),
  },
};

// ---- Assertions ----------------------------------------------------------
describe("phase 5: every surface agrees with the finance service", () => {
  it("dashboard collected == ledger total == sum of confirmed payments", async () => {
    const month = await getCollectedRevenue({ from: SEPT, includeTest: false }, financeDb);
    const ledger = await getCollectedRevenue({}, financeDb);
    expect(month).toBe(3_900_000); // p1 + p2 only: pending p3 and voided p4 never count
    expect(ledger).toBe(3_900_000);
    const summary = await getTransactionSummary("t1", financeDb, NOW);
    expect(summary?.confirmedPaid).toBe(month);
  });

  it("transaction summary: paid, outstanding, progress, overdue", async () => {
    const s = await getTransactionSummary("t1", financeDb, NOW);
    expect(s?.confirmedPaid).toBe(3_900_000);
    expect(s?.outstanding).toBe(4_800_000);
    expect(s?.progressPct).toBe(44.83);
    expect(s?.overdueCount).toBe(1);
    const byId = new Map(s?.installments.map((i) => [i.id, i]));
    expect(byId.get("i0")?.status).toBe("Paid");
    expect(byId.get("i1")?.status).toBe("Late");
    expect(byId.get("i1")?.pendingTotal).toBe(1_900_000); // visible, not counted
    expect(byId.get("i2")?.status).toBe("Pending");
  });

  it("overviews agree with the summary", async () => {
    const overviews = await getTransactionOverviews(["t1"], financeDb, NOW);
    const summary = await getTransactionSummary("t1", financeDb, NOW);
    const ov = overviews.get("t1")!;
    expect(ov.confirmedPaid).toBe(summary?.confirmedPaid);
    expect(ov.outstanding).toBe(summary?.outstanding);
    expect(ov.overdueCount).toBe(summary?.overdueCount);
  });

  it("pending card matches the verification queue and never leaks into revenue", async () => {
    const pending = await getPendingVerification(financeDb);
    expect(pending).toEqual({ count: 1, total: 1_900_000 });
    const counts = await getActionCounts({ db: inboxDb, overdue: await getOverdueInstallments(financeDb, NOW) });
    expect(counts.byCategory.PAYMENT_PENDING_VERIFICATION).toBe(pending.count);
  });

  it("overdue card matches the overdue queue (money-confirmed, not labels)", async () => {
    const overdue = await getOverdueInstallments(financeDb, NOW);
    expect(overdue.map((r) => r.id)).toEqual(["i1"]);
    const cardTotal = overdue.reduce((s, o) => s + (o.scheduledAmount - o.confirmedPaid), 0);
    expect(cardTotal).toBe(1_900_000);
    const counts = await getActionCounts({ db: inboxDb, overdue });
    expect(counts.byCategory.INSTALLMENT_OVERDUE).toBe(overdue.length);
  });

  it("inbox counts: total is the sum of categories; badges derive from them", async () => {
    const overdue = await getOverdueInstallments(financeDb, NOW);
    const counts = await getActionCounts({ db: inboxDb, overdue });
    expect(counts.total).toBe(Object.values(counts.byCategory).reduce((s, n) => s + n, 0));
    expect(counts.byCategory).toMatchObject({
      PAYMENT_PENDING_VERIFICATION: 1,
      RECEIPT_SEND_FAILED: 1, // failed receipt email o1
      SOLD_WITHOUT_TRANSACTION: 1, // b5 only — b6 already has t1
      INSTALLMENT_OVERDUE: 1,
      BOOKING_NEW: 1, // b1 only — b8 is a fixture
      BOOKING_UNASSIGNED: 1,
      INSPECTION_AWAITING_OUTCOME: 1, // b4
      INSPECTION_DUE_TODAY: 1, // b3, seeded at real today
    });
    // Sidebar badge mapping (mirrors /api/admin/inbox/counts).
    const badges = {
      total: counts.total,
      pendingPayments: counts.byCategory.PAYMENT_PENDING_VERIFICATION,
      bookingsNewUnassigned: counts.byCategory.BOOKING_NEW + counts.byCategory.BOOKING_UNASSIGNED,
    };
    expect(badges).toEqual({ total: 8, pendingPayments: 1, bookingsNewUnassigned: 2 });
  });

  it("inbox items link every queue entry to its context", async () => {
    const overdue = await getOverdueInstallments(financeDb, NOW);
    const items = await getActionItems({ db: inboxDb, overdue, now: NOW });
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get("pending-p3")?.href).toBe("/admin/transactions/t1#payment-p3");
    expect(byId.get("pending-p3")?.ref).toBe("PAY-2026-00013");
    expect(byId.get("resend-o1")?.href).toBe("/admin/receipts/r1");
    expect(byId.get("sold-b5")?.href).toBe("/admin/transactions/new?bookingId=b5");
    expect(byId.get("overdue-i1")?.href).toBe("/admin/transactions/t1");
    for (const item of items) {
      expect(item.ref.length).toBeGreaterThan(0);
      expect(item.href.length).toBeGreaterThan(0);
      expect(item.actionLabel.length).toBeGreaterThan(0);
    }
  });

  it("isTest fixtures never appear unless explicitly included", async () => {
    await expect(getCollectedRevenue({ includeTest: true }, financeDb)).resolves.toBe(8_900_000);
    await expect(getTransactionSummary("tX", financeDb, NOW)).resolves.toBe(null);
    const shown = await getTransactionSummary("tX", financeDb, NOW, { includeTest: true });
    expect(shown?.confirmedPaid).toBe(5_000_000);
    const counts = await getActionCounts({ db: inboxDb, overdue: await getOverdueInstallments(financeDb, NOW) });
    expect(counts.byCategory.BOOKING_NEW).toBe(1);
    const withTest = await getActionCounts({
      db: inboxDb,
      includeTest: true,
      overdue: await getOverdueInstallments(financeDb, NOW, { includeTest: true }),
    });
    expect(withTest.byCategory.BOOKING_NEW).toBe(2); // b8 revealed
    expect(withTest.byCategory.INSTALLMENT_OVERDUE).toBe(2); // ix revealed
  });
});
