import type { Prisma } from "@/generated/prisma/client";

// Single ledger service (Step 2): the ONLY code allowed to write money
// entries (LedgerEntry) and allocation rows (PaymentAllocation), and to
// compute balances from them. Callers (payment confirmation, void, backfill)
// run these inside their own DB transaction and keep maintaining the legacy
// stored columns (Transaction.totalPaid/outstandingBalance,
// Installment.paidAmount/status) until reads switch over — dual-write, with
// verifyTransactionLedger() proving the two agree.
//
// Money rules (whole-naira Int, never floats):
//   totalPayable = sum(CHARGE_*) - sum(DISCOUNT) - sum(WAIVER)
//   totalPaid    = sum(PAYMENT) - sum(REVERSAL of payments)
//   outstanding  = totalPayable - totalPaid
// Only CONFIRMED payments get PAYMENT entries. PENDING payments live only in
// the Payment table. Voids append a REVERSAL entry — rows are never edited.

export const LEDGER_TYPES = [
  "CHARGE_BASE",
  "CHARGE_INTEREST",
  "CHARGE_FEE",
  "PAYMENT",
  "DISCOUNT",
  "WAIVER",
  "ADJUSTMENT",
  "REVERSAL",
] as const;
export type LedgerEntryType = (typeof LEDGER_TYPES)[number];

const CHARGE_TYPES: ReadonlySet<string> = new Set(["CHARGE_BASE", "CHARGE_INTEREST", "CHARGE_FEE"]);

export type LedgerDirection = "DEBIT" | "CREDIT";

export type TxClient = Prisma.TransactionClient;

export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LedgerError";
  }
}

function assertWholeNaira(amount: number, what: string): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new LedgerError(`${what} must be a positive whole-naira integer, got ${amount}`);
  }
}

// ---------------------------------------------------------------------------
// Allocation planner (pure): waterfall a payment across installments, oldest
// unpaid first, from the targeted installment forward. Returns per-installment
// amounts that sum EXACTLY to paymentAmount, or throws LedgerError when the
// suffix capacity is insufficient (caller must reject, never truncate).
// ---------------------------------------------------------------------------

export type AllocationInput = {
  id: string;
  installmentNumber: number;
  scheduledAmount: number;
  paidAmount: number;
};

export type AllocationStep = { installmentId: string; amount: number };

export function planAllocation(
  ordered: AllocationInput[],
  startInstallmentId: string | null,
  paymentAmount: number
): AllocationStep[] {
  assertWholeNaira(paymentAmount, "payment amount");
  const sorted = [...ordered].sort((a, b) => a.installmentNumber - b.installmentNumber);
  const startIdx = startInstallmentId ? sorted.findIndex((i) => i.id === startInstallmentId) : 0;
  const suffix = startIdx >= 0 ? sorted.slice(startIdx) : sorted;
  const plan: AllocationStep[] = [];
  let remaining = paymentAmount;
  for (const inst of suffix) {
    if (remaining <= 0) break;
    const capacity = inst.scheduledAmount - inst.paidAmount;
    if (capacity <= 0) continue;
    const alloc = Math.min(remaining, capacity);
    plan.push({ installmentId: inst.id, amount: alloc });
    remaining -= alloc;
  }
  if (remaining > 0) {
    throw new LedgerError(
      `Payment of ${paymentAmount} exceeds the remaining scheduled ${paymentAmount - remaining} from the targeted installment onward`
    );
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Writers (tx-scoped; throw LedgerError on misuse, P2002 on replay)
// ---------------------------------------------------------------------------

export type PostEntryInput = {
  transactionId: string;
  type: LedgerEntryType;
  amount: number;
  direction: LedgerDirection;
  effectiveDate: Date;
  paymentId?: string | null;
  method?: string | null;
  bankReference?: string | null;
  reversesEntryId?: string | null;
  recordedById?: string | null;
  note?: string | null;
  idempotencyKey: string;
};

export async function postLedgerEntry(tx: TxClient, input: PostEntryInput) {
  if (!(LEDGER_TYPES as readonly string[]).includes(input.type)) {
    throw new LedgerError(`Unknown ledger entry type: ${input.type}`);
  }
  assertWholeNaira(input.amount, "ledger amount");
  if (!input.idempotencyKey) throw new LedgerError("idempotencyKey is required");
  return tx.ledgerEntry.create({
    data: {
      transactionId: input.transactionId,
      type: input.type,
      amount: input.amount,
      direction: input.direction,
      effectiveDate: input.effectiveDate,
      paymentId: input.paymentId ?? null,
      method: input.method ?? null,
      bankReference: input.bankReference ?? null,
      reversesEntryId: input.reversesEntryId ?? null,
      recordedById: input.recordedById ?? null,
      note: input.note ?? null,
      idempotencyKey: input.idempotencyKey,
    },
  });
}

export async function postPaymentEntry(
  tx: TxClient,
  opts: {
    transactionId: string;
    paymentId: string;
    amount: number;
    effectiveDate: Date;
    method?: string | null;
    bankReference?: string | null;
    recordedById?: string | null;
    idempotencyKey?: string | null;
  }
) {
  return postLedgerEntry(tx, {
    transactionId: opts.transactionId,
    type: "PAYMENT",
    amount: opts.amount,
    direction: "CREDIT",
    effectiveDate: opts.effectiveDate,
    paymentId: opts.paymentId,
    method: opts.method,
    bankReference: opts.bankReference,
    recordedById: opts.recordedById,
    idempotencyKey: opts.idempotencyKey ?? `payment:${opts.paymentId}`,
  });
}

export async function postAllocations(
  tx: TxClient,
  paymentId: string,
  plan: AllocationStep[]
) {
  const sum = plan.reduce((s, p) => s + p.amount, 0);
  for (const step of plan) {
    assertWholeNaira(step.amount, "allocation amount");
    await tx.paymentAllocation.create({
      data: {
        paymentId,
        installmentId: step.installmentId,
        amount: step.amount,
      },
    });
  }
  return sum;
}

// ---------------------------------------------------------------------------
// Readers: balances derived from entries only
// ---------------------------------------------------------------------------

export type LedgerBalances = {
  totalPayable: number;
  totalPaid: number;
  outstanding: number;
  chargeTotal: number;
  discountTotal: number;
  paymentTotal: number;
  reversalTotal: number;
  entryCount: number;
};

export async function getLedgerBalances(
  tx: TxClient,
  transactionId: string
): Promise<LedgerBalances> {
  const entries = await tx.ledgerEntry.findMany({ where: { transactionId } });
  let chargeTotal = 0;
  let discountTotal = 0;
  let paymentTotal = 0;
  let reversalTotal = 0;
  for (const e of entries) {
    if (CHARGE_TYPES.has(e.type)) chargeTotal += e.amount;
    else if (e.type === "DISCOUNT" || e.type === "WAIVER") discountTotal += e.amount;
    else if (e.type === "PAYMENT") paymentTotal += e.amount;
    else if (e.type === "REVERSAL") reversalTotal += e.amount;
  }
  const totalPayable = chargeTotal - discountTotal;
  const totalPaid = paymentTotal - reversalTotal;
  return {
    totalPayable,
    totalPaid,
    outstanding: totalPayable - totalPaid,
    chargeTotal,
    discountTotal,
    paymentTotal,
    reversalTotal,
    entryCount: entries.length,
  };
}

export async function getPaymentAllocations(tx: TxClient, paymentId: string) {
  return tx.paymentAllocation.findMany({ where: { paymentId } });
}

// ---------------------------------------------------------------------------
// Verification: ledger vs legacy stored columns vs finance-service derivation.
// Returns mismatches (empty = agreement). Used by the backfill script and,
// later, the nightly reconciliation job.
// ---------------------------------------------------------------------------

export type LedgerCheck = {
  transactionRef: string;
  ok: boolean;
  ledger: LedgerBalances;
  stored: { totalPaid: number; outstanding: number };
  installmentPaid: { installmentNumber: number; stored: number; allocated: number }[];
  problems: string[];
};

export async function verifyTransactionLedger(
  tx: TxClient,
  transactionId: string
): Promise<LedgerCheck> {
  const txn = await tx.transaction.findUnique({
    where: { id: transactionId },
    include: { installments: { orderBy: { installmentNumber: "asc" } } },
  });
  if (!txn) throw new LedgerError(`Transaction ${transactionId} not found`);
  const ledger = await getLedgerBalances(tx, transactionId);
  const problems: string[] = [];
  if (ledger.totalPaid !== txn.totalPaid) {
    problems.push(`totalPaid: ledger ${ledger.totalPaid} != stored ${txn.totalPaid}`);
  }
  if (ledger.outstanding !== txn.outstandingBalance) {
    problems.push(`outstanding: ledger ${ledger.outstanding} != stored ${txn.outstandingBalance}`);
  }
  if (ledger.totalPayable !== txn.totalPayable) {
    problems.push(`totalPayable: ledger ${ledger.totalPayable} != stored ${txn.totalPayable}`);
  }
  const allocs = await tx.paymentAllocation.findMany({
    where: { payment: { transactionId } },
  });
  const allocatedByInst = new Map<string, number>();
  for (const a of allocs) {
    allocatedByInst.set(a.installmentId, (allocatedByInst.get(a.installmentId) ?? 0) + a.amount);
  }
  const installmentPaid = txn.installments.map((i) => ({
    installmentNumber: i.installmentNumber,
    stored: i.paidAmount,
    allocated: allocatedByInst.get(i.id) ?? 0,
  }));
  for (const row of installmentPaid) {
    if (row.stored !== row.allocated) {
      problems.push(`installment #${row.installmentNumber}: allocated ${row.allocated} != stored paid ${row.stored}`);
    }
  }
  // Invariant: every confirmed payment has exactly one PAYMENT entry, and
  // allocation sums equal payment amounts.
  const payments = await tx.payment.findMany({ where: { transactionId, status: "CONFIRMED" } });
  const entries = await tx.ledgerEntry.findMany({ where: { transactionId, type: "PAYMENT" } });
  const entryByPayment = new Map(entries.map((e) => [e.paymentId, e]));
  for (const p of payments) {
    const entry = entryByPayment.get(p.id);
    if (!entry) {
      problems.push(`payment ${p.paymentReference}: no PAYMENT ledger entry`);
      continue;
    }
    if (entry.amount !== p.amount) {
      problems.push(`payment ${p.paymentReference}: entry ${entry.amount} != payment ${p.amount}`);
    }
    const allocSum = allocs.filter((a) => a.paymentId === p.id).reduce((s, a) => s + a.amount, 0);
    if (allocSum !== p.amount) {
      problems.push(`payment ${p.paymentReference}: allocated ${allocSum} != payment ${p.amount}`);
    }
  }
  return {
    transactionRef: txn.ref,
    ok: problems.length === 0,
    ledger,
    stored: { totalPaid: txn.totalPaid, outstanding: txn.outstandingBalance },
    installmentPaid,
    problems,
  };
}
