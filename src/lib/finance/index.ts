import { prisma } from "@/lib/prisma";
import { deriveInstallmentStatus } from "@/lib/paymentConfirmation";
import { startOfTodayLagos } from "@/lib/time";

// Single source of truth for every financial figure in the app
// (AGENTS.md rule 3). Pages and API routes must call these functions —
// never their own ad-hoc money queries — so dashboard, ledger and
// transaction pages always agree.
//
// Definitions:
// - "Collected" = CONFIRMED payments only, by paymentDate. Pending, failed
//   and voided (CANCELLED) payments never count. (No VOIDED status exists;
//   voiding sets CANCELLED.)
// - Test fixtures (transaction.isTest) are excluded everywhere.
// - Installment display status derives from confirmed money:
//   Paid (>= scheduled) → Late (past due, not fully paid) → Partial
//   (0 < paid < scheduled) → Pending.

export type FinanceInstallmentStatus = "Paid" | "Late" | "Partial" | "Pending";

export function toDisplayStatus(confirmedPaid: number, scheduledAmount: number, dueDate: Date, now: Date = new Date()): FinanceInstallmentStatus {
  if (confirmedPaid >= scheduledAmount) return "Paid";
  if (dueDate < now) return "Late";
  if (confirmedPaid > 0) return "Partial";
  return "Pending";
}

export type InstallmentView = {
  id: string;
  installmentNumber: number;
  type: string;
  dueDate: Date;
  scheduledAmount: number;
  confirmedPaid: number;
  pendingTotal: number;
  status: FinanceInstallmentStatus;
  overdue: boolean;
};

export type TransactionSummary = {
  id: string;
  ref: string;
  totalPayable: number;
  confirmedPaid: number;
  outstanding: number;
  progressPct: number;
  overdueCount: number;
  installments: InstallmentView[];
};

// Minimal DB surface so tests can inject fakes.
export type FinanceDb = {
  payment: {
    aggregate(args: unknown): Promise<{ _sum: { amount: number | null } }>;
    count(args: unknown): Promise<number>;
    findMany(args: unknown): Promise<
      { amount: number; paymentDate: Date; status: string; installmentId: string | null; transactionId: string }[]
    >;
  };
  installment: {
    findMany(args: unknown): Promise<
      { id: string; transactionId: string; installmentNumber: number; type: string; dueDate: Date; scheduledAmount: number; status: string }[]
    >;
  };
  transaction: {
    findMany(args: unknown): Promise<{ id: string; totalPayable: number }[]>;
    findUnique(args: unknown): Promise<
      | {
          id: string;
          ref: string;
          totalPayable: number;
          isTest: boolean;
          installments: { id: string; installmentNumber: number; type: string; dueDate: Date; scheduledAmount: number; status: string }[];
        }
      | null
    >;
  };
};

const realDb = prisma as unknown as FinanceDb;

function confirmedWhere(from?: Date, to?: Date, includeTest: boolean = false) {
  return {
    status: "CONFIRMED" as const,
    ...(includeTest ? {} : { transaction: { isTest: false } }),
    ...(from || to ? { paymentDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };
}

export async function getCollectedRevenue(
  { from, to, includeTest = false }: { from?: Date; to?: Date; includeTest?: boolean } = {},
  db: FinanceDb = realDb
): Promise<number> {
  const agg = await db.payment.aggregate({ where: confirmedWhere(from, to, includeTest), _sum: { amount: true } });
  return agg._sum.amount ?? 0;
}

export async function getOverdueInstallments(
  db: FinanceDb = realDb,
  now: Date = startOfTodayLagos(),
  opts: { includeTest?: boolean } = {}
) {
  const rows = await db.installment.findMany({
    where: {
      ...(opts.includeTest ? {} : { transaction: { isTest: false } }),
      dueDate: { lt: now },
      status: { notIn: ["PAID", "WAIVED"] },
    },
    orderBy: { dueDate: "asc" },
  });
  // Confirm against money, not just the stored label: an installment whose
  // confirmed payments already cover the schedule is not overdue even if its
  // stored status lags (reconcile-installments.ts fixes the label).
  const payments = await db.payment.findMany({
    where: { status: "CONFIRMED", installmentId: { in: rows.map((r) => r.id) } },
    select: { amount: true, installmentId: true },
  });
  const paidByInst = new Map<string, number>();
  for (const p of payments) {
    if (p.installmentId) paidByInst.set(p.installmentId, (paidByInst.get(p.installmentId) ?? 0) + p.amount);
  }
  return rows
    .map((r) => ({ ...r, confirmedPaid: paidByInst.get(r.id) ?? 0 }))
    .filter((r) => r.confirmedPaid < r.scheduledAmount);
}

export async function getTransactionSummary(
  transactionId: string,
  db: FinanceDb = realDb,
  now: Date = startOfTodayLagos(),
  opts: { includeTest?: boolean } = {}
): Promise<TransactionSummary | null> {
  const txn = await db.transaction.findUnique({
    where: { id: transactionId },
    include: { installments: { orderBy: { installmentNumber: "asc" } } },
  });
  if (!txn) return null;
  if (txn.isTest && !opts.includeTest) return null;
  const payments = await db.payment.findMany({
    where: { transactionId, status: { in: ["CONFIRMED", "PENDING_VERIFICATION"] } },
    select: { amount: true, status: true, installmentId: true },
  });
  const confirmedByInst = new Map<string, number>();
  const pendingByInst = new Map<string, number>();
  let confirmedPaid = 0;
  for (const p of payments) {
    if (p.status === "CONFIRMED") {
      confirmedPaid += p.amount;
      if (p.installmentId) confirmedByInst.set(p.installmentId, (confirmedByInst.get(p.installmentId) ?? 0) + p.amount);
    } else if (p.installmentId) {
      pendingByInst.set(p.installmentId, (pendingByInst.get(p.installmentId) ?? 0) + p.amount);
    }
  }
  const outstanding = txn.totalPayable - confirmedPaid;
  const installments: InstallmentView[] = txn.installments.map((i) => {
    const paid = confirmedByInst.get(i.id) ?? 0;
    const status = toDisplayStatus(paid, i.scheduledAmount, new Date(i.dueDate), now);
    return {
      id: i.id,
      installmentNumber: i.installmentNumber,
      type: i.type,
      dueDate: new Date(i.dueDate),
      scheduledAmount: i.scheduledAmount,
      confirmedPaid: paid,
      pendingTotal: pendingByInst.get(i.id) ?? 0,
      status,
      overdue: status === "Late",
    };
  });
  return {
    id: txn.id,
    ref: txn.ref,
    totalPayable: txn.totalPayable,
    confirmedPaid,
    outstanding,
    progressPct: txn.totalPayable > 0 ? Math.round((confirmedPaid / txn.totalPayable) * 10000) / 100 : 0,
    overdueCount: installments.filter((i) => i.overdue).length,
    installments,
  };
}

// Re-exported for call sites that still need the stored-label derivation.
export { deriveInstallmentStatus };

// Awaiting verification: count + naira total of PENDING_VERIFICATION payments
// on real transactions. Never counted as collected.
export async function getPendingVerification(
  db: FinanceDb = realDb,
  opts: { includeTest?: boolean } = {}
): Promise<{ count: number; total: number }> {
  const where = {
    status: "PENDING_VERIFICATION" as const,
    ...(opts.includeTest ? {} : { transaction: { isTest: false } }),
  };
  const [agg, count] = await Promise.all([
    db.payment.aggregate({ where, _sum: { amount: true } }),
    db.payment.count({ where }),
  ]);
  return { count, total: agg._sum.amount ?? 0 };
}

export type TransactionOverview = {
  id: string;
  confirmedPaid: number;
  outstanding: number;
  overdueCount: number;
};

// Batch per-transaction money for list views (one query set, no N+1, no
// ad-hoc sums in pages). totalPayable is a contract term read from the row;
// outstanding/overdue always derive from CONFIRMED payments here.
export async function getTransactionOverviews(
  transactionIds: string[],
  db: FinanceDb = realDb,
  now: Date = startOfTodayLagos()
): Promise<Map<string, TransactionOverview>> {
  const out = new Map<string, TransactionOverview>();
  if (transactionIds.length === 0) return out;
  const [txns, installments, payments] = await Promise.all([
    db.transaction.findMany({ where: { id: { in: transactionIds } }, select: { id: true, totalPayable: true } }),
    db.installment.findMany({ where: { transactionId: { in: transactionIds } } }),
    db.payment.findMany({ where: { transactionId: { in: transactionIds }, status: "CONFIRMED" } }),
  ]);
  const paidByTxn = new Map<string, number>();
  const paidByInst = new Map<string, number>();
  for (const p of payments) {
    paidByTxn.set(p.transactionId, (paidByTxn.get(p.transactionId) ?? 0) + p.amount);
    if (p.installmentId) paidByInst.set(p.installmentId, (paidByInst.get(p.installmentId) ?? 0) + p.amount);
  }
  const overdueByTxn = new Map<string, number>();
  for (const i of installments) {
    const paid = paidByInst.get(i.id) ?? 0;
    if (new Date(i.dueDate) < now && i.status !== "WAIVED" && paid < i.scheduledAmount) {
      overdueByTxn.set(i.transactionId, (overdueByTxn.get(i.transactionId) ?? 0) + 1);
    }
  }
  for (const t of txns) {
    const paid = paidByTxn.get(t.id) ?? 0;
    out.set(t.id, { id: t.id, confirmedPaid: paid, outstanding: t.totalPayable - paid, overdueCount: overdueByTxn.get(t.id) ?? 0 });
  }
  return out;
}
