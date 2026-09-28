import { prisma } from "@/lib/prisma";
import { deriveInstallmentStatus } from "@/lib/paymentConfirmation";
import { lagosMonthRange, startOfTodayLagos } from "@/lib/time";

// Single source of truth for every financial figure in the app
// (AGENTS.md rule 3). Pages and API routes must call these functions —
// never their own ad-hoc money queries — so dashboard, sidebar and
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

function confirmedWhere(from?: Date, to?: Date) {
  return {
    status: "CONFIRMED" as const,
    transaction: { isTest: false },
    ...(from || to ? { paymentDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };
}

export async function getCollectedRevenue(
  { from, to }: { from?: Date; to?: Date } = {},
  db: FinanceDb = realDb
): Promise<number> {
  const agg = await db.payment.aggregate({ where: confirmedWhere(from, to), _sum: { amount: true } });
  return agg._sum.amount ?? 0;
}

export async function getMonthlyTargetProgress(
  month: Date = new Date(),
  db: FinanceDb = realDb
): Promise<{ collected: number; goal: number; pct: number }> {
  const goal = Number(process.env.MONTHLY_SALES_TARGET) || 150_000_000;
  // Month boundary in Lagos time (rule: business timezone).
  const { start, end } = lagosMonthRange(month);
  const collected = await getCollectedRevenue({ from: start, to: end }, db);
  return { collected, goal, pct: goal > 0 ? Math.min(100, Math.round((collected / goal) * 100)) : 0 };
}

export async function getOverdueInstallments(db: FinanceDb = realDb, now: Date = startOfTodayLagos()) {
  const rows = await db.installment.findMany({
    where: { transaction: { isTest: false }, dueDate: { lt: now }, status: { notIn: ["PAID", "WAIVED"] } },
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

export async function getRevenueSparkline(days: number = 14, db: FinanceDb = realDb, now: Date = new Date()): Promise<number[]> {
  // Day buckets anchored at Lagos midnight so every server agrees.
  const end = new Date(startOfTodayLagos(now).getTime() + 86_400_000);
  const start = new Date(end.getTime() - days * 86_400_000);
  const payments = await db.payment.findMany({
    where: { ...confirmedWhere(start, now) },
    select: { amount: true, paymentDate: true },
  });
  const buckets = Array.from({ length: days }, () => 0);
  for (const p of payments) {
    const idx = Math.floor((new Date(p.paymentDate).getTime() - start.getTime()) / 86_400_000);
    if (idx >= 0 && idx < days) buckets[idx] += p.amount;
  }
  return buckets;
}

export async function getTransactionSummary(transactionId: string, db: FinanceDb = realDb, now: Date = startOfTodayLagos()): Promise<TransactionSummary | null> {
  const txn = await db.transaction.findUnique({
    where: { id: transactionId },
    include: { installments: { orderBy: { installmentNumber: "asc" } } },
  });
  if (!txn) return null;
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
