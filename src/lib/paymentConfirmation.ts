import type { Prisma } from "@/generated/prisma/client";
import { amountToWords } from "./receipts/amountToWords";

// Shared payment-confirmation core: database work ONLY. No PDF rendering,
// no filesystem access, no email, no network. Slow or fallible side effects
// live in receiptDelivery.ts and run after the transaction commits, so a
// >5s PDF render or SMTP stall can never roll back a confirmation.

export type TxClient = Prisma.TransactionClient;

export type DeliveryState = "PENDING" | "GENERATED" | "FAILED" | "SENT";

export type InstallmentStatusLabel =
  | "PENDING"
  | "DUE"
  | "PAID"
  | "PARTIALLY_PAID"
  | "OVERDUE"
  | "WAIVED";

// Typed failures — routes map these to user-friendly messages via
// toUserFacingError() and never leak them to the client raw.
export class PaymentAlreadyHandledError extends Error {
  constructor(paymentId: string) {
    super(`Payment ${paymentId} is no longer pending (already confirmed, voided, or failed)`);
    this.name = "PaymentAlreadyHandledError";
  }
}

export class OverScheduleError extends Error {
  readonly paidAmount: number;
  readonly amount: number;
  readonly scheduledAmount: number;
  constructor(paidAmount: number, amount: number, scheduledAmount: number) {
    super(
      `Payment of ${amount} would exceed the scheduled ${scheduledAmount} (already ${paidAmount} recorded against this installment)`
    );
    this.name = "OverScheduleError";
    this.paidAmount = paidAmount;
    this.amount = amount;
    this.scheduledAmount = scheduledAmount;
  }
}

export class PaymentCorruptStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentCorruptStateError";
  }
}

// Status derives from CONFIRMED money only. Pending (unverified) payments
// never count as paid — they must not move an installment off Due/Late.
export function deriveInstallmentStatus(
  confirmedPaid: number,
  scheduledAmount: number,
  dueDate: Date,
  now: Date = new Date()
): InstallmentStatusLabel {
  if (confirmedPaid >= scheduledAmount) return "PAID";
  if (confirmedPaid > 0) return dueDate < now ? "OVERDUE" : "PARTIALLY_PAID";
  if (dueDate < now) return "OVERDUE";
  return dueDate.toDateString() === now.toDateString() ? "DUE" : "PENDING";
}

// Server-side duplicate/overpayment guard: the sum of what is already on an
// installment (confirmed paidAmount + still-pending payments) plus a new
// amount must not exceed the scheduled amount. This is what stops N
// identical pending payments from over-crediting one installment.
export function wouldExceedSchedule(
  confirmedPaid: number,
  pendingSum: number,
  newAmount: number,
  scheduledAmount: number
): boolean {
  return confirmedPaid + pendingSum + newAmount > scheduledAmount;
}

// Never render these raw: Prisma messages carry constraint names, table
// names, and driver detail that mean nothing to an admin and may leak paths.
export function toUserFacingError(error: unknown, action: "confirm" | "record" | "void" | "save"): string {
  const verb =
    action === "confirm"
      ? "confirm payment"
      : action === "record"
        ? "record payment"
        : action === "void"
          ? "void payment"
          : "save";
  if (error instanceof PaymentAlreadyHandledError) {
    return action === "confirm"
      ? "This payment was already confirmed or voided. Refresh to see the latest state."
      : "This payment is no longer pending. Refresh to see the latest state.";
  }
  if (error instanceof OverScheduleError) {
    return (
      `This would exceed the installment's scheduled amount of ₦${error.scheduledAmount.toLocaleString("en-NG")} ` +
      `(₦${error.paidAmount.toLocaleString("en-NG")} already recorded). Record one installment at a time.`
    );
  }
  if (error instanceof PaymentCorruptStateError) {
    return "The payment data looks inconsistent, so nothing was changed. Ask engineering to review the audit log.";
  }
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : null;
  if (code === "P2002") return "This was already recorded. Refresh to see the latest state.";
  if (code === "P2025") return "The record no longer exists. Refresh to see the latest state.";
  if (code === "P2034") return "Someone else just changed this. Refresh and try again.";
  return `Couldn't ${verb}. Please try again.`;
}

export function logServerError(context: string, error: unknown): void {
  // No structured logger exists in this codebase — console.error with context.
  console.error(`[payments] ${context}`, error);
}

export type ConfirmDbInput = {
  paymentId: string;
  transactionId: string;
  confirmedById?: string | null;
  confirmedByName?: string | null;
  verificationNotes?: string | null;
  receiptRef: string; // pre-generated BEFORE the transaction (DB uniqueness rechecked by constraint)
  receiptUrl: string; // tokenized client URL ({APP_URL}/r/{accessToken})
  qrTargetUrl: string;
  pdfPath: string; // private storage path (storage/receipts/{ref}.pdf), never public/
  accessToken: string; // random 32-byte URL-safe token backing receiptUrl
};

export type ConfirmDbResult = {
  payment: { id: string; amount: number; paymentDate: Date; paymentMethod: string | null };
  installment: { id: string; type: string; installmentNumber: number } | null;
  transactionId: string;
  receiptId: string;
  newTotalPaid: number;
  newOutstanding: number;
  isPaidInFull: boolean;
};

// Atomic DB unit for confirmation: claim the payment, move the installment,
// recompute totals, create the receipt row (delivery PENDING — the PDF and
// email happen post-commit). Throws PaymentAlreadyHandledError /
// OverScheduleError on conflicts. Everything here is tx.* only.
export async function applyConfirmationDbUnit(tx: TxClient, input: ConfirmDbInput): Promise<ConfirmDbResult> {
  const now = new Date();

  // Idempotent claim: exactly one confirmer can flip PENDING→CONFIRMED.
  const claimed = await tx.payment.updateMany({
    where: { id: input.paymentId, transactionId: input.transactionId, status: "PENDING_VERIFICATION" },
    data: {
      status: "CONFIRMED",
      confirmedAt: now,
      confirmedById: input.confirmedById ?? undefined,
      verificationNotes: input.verificationNotes ?? undefined,
      updatedAt: now,
    },
  });
  if (claimed.count === 0) throw new PaymentAlreadyHandledError(input.paymentId);

  const payment = await tx.payment.findUnique({
    where: { id: input.paymentId },
    include: {
      transaction: { include: { installments: true, paymentPlan: true } },
    },
  });
  if (!payment) throw new PaymentCorruptStateError("Confirmed payment row disappeared mid-transaction");

  const transaction = payment.transaction;
  if (transaction.outstandingBalance < payment.amount) {
    // Genuinely over-paid at the transaction level (totals moved under us).
    throw new OverScheduleError(
      transaction.totalPaid,
      payment.amount,
      transaction.totalPayable
    );
  }

  // Resolve the installment: the payment's own, else the next unpaid one.
  let installment =
    payment.installmentId != null
      ? await tx.installment.findUnique({ where: { id: payment.installmentId } })
      : null;
  if (!installment) {
    const next = transaction.installments.find(
      (i) => i.status !== "PAID" && i.status !== "WAIVED"
    );
    if (next) {
      installment = await tx.installment.findUnique({ where: { id: next.id } });
      if (installment) {
        await tx.payment.update({ where: { id: payment.id }, data: { installmentId: installment.id } });
      }
    }
  }

  if (installment) {
    // Re-read inside the tx, then enforce the scheduled cap.
    const fresh = await tx.installment.findUnique({ where: { id: installment.id } });
    if (!fresh) throw new PaymentCorruptStateError("Installment row disappeared mid-transaction");
    const already = fresh.paidAmount ?? 0;
    if (already + payment.amount > fresh.scheduledAmount) {
      throw new OverScheduleError(already, payment.amount, fresh.scheduledAmount);
    }
    const newPaid = already + payment.amount;
    await tx.installment.update({
      where: { id: fresh.id },
      data: {
        paidAmount: newPaid,
        status: deriveInstallmentStatus(newPaid, fresh.scheduledAmount, new Date(fresh.dueDate), now),
        updatedAt: now,
      },
    });
    installment = { ...fresh, paidAmount: newPaid };
  }

  // Totals derive from CONFIRMED payments only — recomputed, never incremented.
  const confirmed = await tx.payment.findMany({
    where: { transactionId: transaction.id, status: "CONFIRMED" },
  });
  const newTotalPaid = confirmed.reduce((sum, p) => sum + p.amount, 0);
  const newOutstanding = transaction.totalPayable - newTotalPaid;
  if (newOutstanding < 0) {
    throw new PaymentCorruptStateError("Confirmed payments exceed the transaction total");
  }
  const isPaidInFull = newOutstanding === 0;

  await tx.transaction.update({
    where: { id: transaction.id },
    data: {
      totalPaid: newTotalPaid,
      outstandingBalance: newOutstanding,
      status: isPaidInFull ? "PAID_IN_FULL" : transaction.status,
      updatedAt: now,
    },
  });

  if (isPaidInFull) {
    await tx.installment.updateMany({
      where: { transactionId: transaction.id, status: { not: "PAID" } },
      data: { status: "PAID" },
    });
  }

  const issuedDateStr = formatDMY(new Date(payment.paymentDate));
  const receipt = await tx.receipt.create({
    data: {
      ref: input.receiptRef,
      bookingId: transaction.bookingId,
      transactionId: transaction.id,
      paymentId: payment.id,
      source: "PAYMENT_CONFIRMATION",
      property: `${transaction.estate} · ${transaction.unitType ?? ""} · ${transaction.plotCode ?? ""}`.trim(),
      estate: transaction.estate,
      plotCode: transaction.plotCode,
      unitType: transaction.unitType,
      sqm: transaction.sqm,
      customerName: transaction.customerName,
      customerEmail: transaction.customerEmail,
      customerPhone: transaction.customerPhone,
      amountBeforeDiscount: transaction.baseAmount,
      discount: 0,
      finalAmount: payment.amount,
      amountInWords: amountToWords(payment.amount),
      currency: "NGN",
      paymentDescription: describePayment(installment, transaction),
      paymentMethod: payment.paymentMethod,
      paymentHistory: [{ date: issuedDateStr, method: payment.paymentMethod ?? "Bank Transfer", amount: payment.amount }],
      unitPrice: transaction.unitPrice,
      plotQuantity: transaction.plotQuantity,
      paymentPlanCode: transaction.paymentPlan?.code ?? null,
      paymentPlanName: transaction.paymentPlan?.name ?? null,
      issuedAt: new Date(payment.paymentDate),
      recipientEmail: transaction.customerEmail,
      status: "generated",
      pdfStatus: "PENDING",
      emailStatus: "PENDING",
      receiptUrl: input.receiptUrl,
      qrTargetUrl: input.qrTargetUrl,
      pdfPath: input.pdfPath,
      accessToken: input.accessToken,
      createdById: input.confirmedById ?? undefined,
    },
  });

  // Receipt email queued in the SAME atomic unit (DB work only — delivery
  // happens post-commit via the outbox processor). If confirmation commits,
  // the email is durably queued; no post-commit enqueue can be lost.
  await tx.emailOutbox.create({
    data: {
      type: "receipt",
      to: transaction.customerEmail,
      payload: { receiptId: receipt.id },
      relatedType: "receipt",
      relatedId: receipt.id,
    },
  });

  // Immutable audit row in the same unit: who confirmed what.
  await tx.auditEvent.create({
    data: {
      actorId: input.confirmedById ?? null,
      actorName: input.confirmedByName ?? "System",
      action: "payment.confirm",
      entityType: "payment",
      entityId: payment.id,
      before: { status: "PENDING_VERIFICATION", amount: payment.amount },
      after: { status: "CONFIRMED", amount: payment.amount, receiptRef: input.receiptRef },
    },
  });

  return {
    payment: {
      id: payment.id,
      amount: payment.amount,
      paymentDate: new Date(payment.paymentDate),
      paymentMethod: payment.paymentMethod,
    },
    installment: installment
      ? { id: installment.id, type: installment.type, installmentNumber: installment.installmentNumber }
      : null,
    transactionId: transaction.id,
    receiptId: receipt.id,
    newTotalPaid,
    newOutstanding,
    isPaidInFull,
  };
}

// Human payment description, e.g.
// "Initial payment — Belgrove Peninsula, 3-Bedroom Terrace Duplex (PEN-150SQM)".
// Never "Payment for Initial Payment".
export function describePayment(
  installment: { type: string; installmentNumber: number } | null,
  transaction: { estate: string; unitType?: string | null; plotCode?: string | null }
): string {
  const kind =
    !installment || installment.type === "INITIAL" ? "Initial payment" : `Month ${installment.installmentNumber} payment`;
  const unit = transaction.unitType ? `, ${transaction.unitType}` : "";
  const plot = transaction.plotCode ? ` (${transaction.plotCode})` : "";
  return `${kind} — ${transaction.estate}${unit}${plot}`;
}

export type VoidDbResult = {
  paymentId: string;
  newTotalPaid: number;
  newOutstanding: number;
};

// Atomic reversal of a CONFIRMED payment: payment→CANCELLED, the confirmed
// amount subtracted back off its installment, totals recomputed. The receipt
// row is intentionally left in place as an audit trail (it no longer counts
// toward totals). Pending payments are voided without touching totals.
export async function reverseConfirmedPaymentDbUnit(
  tx: TxClient,
  input: { paymentId: string; transactionId: string; reason?: string | null; actorId?: string | null; actorName?: string | null }
): Promise<VoidDbResult> {
  const now = new Date();

  const claimed = await tx.payment.updateMany({
    where: { id: input.paymentId, transactionId: input.transactionId, status: "CONFIRMED" },
    data: {
      status: "CANCELLED",
      verificationNotes: input.reason ? `Voided (reversal): ${input.reason}` : "Voided (reversal of confirmed payment)",
      updatedAt: now,
    },
  });
  if (claimed.count === 0) throw new PaymentAlreadyHandledError(input.paymentId);

  const payment = await tx.payment.findUnique({ where: { id: input.paymentId } });
  if (!payment) throw new PaymentCorruptStateError("Voided payment row disappeared mid-transaction");

  const transaction = await tx.transaction.findUnique({
    where: { id: input.transactionId },
    include: { installments: true },
  });
  if (!transaction) throw new PaymentCorruptStateError("Transaction row disappeared mid-transaction");

  if (payment.installmentId) {
    const installment = await tx.installment.findUnique({ where: { id: payment.installmentId } });
    if (installment) {
      const newPaid = (installment.paidAmount ?? 0) - payment.amount;
      if (newPaid < 0) {
        throw new PaymentCorruptStateError("Reversal would drive the installment balance negative");
      }
      await tx.installment.update({
        where: { id: installment.id },
        data: {
          paidAmount: newPaid,
          status: deriveInstallmentStatus(newPaid, installment.scheduledAmount, new Date(installment.dueDate), now),
          updatedAt: now,
        },
      });
    }
  }

  const confirmed = await tx.payment.findMany({
    where: { transactionId: transaction.id, status: "CONFIRMED" },
  });
  const newTotalPaid = confirmed.reduce((sum, p) => sum + p.amount, 0);
  const newOutstanding = transaction.totalPayable - newTotalPaid;

  await tx.transaction.update({
    where: { id: transaction.id },
    data: {
      totalPaid: newTotalPaid,
      outstandingBalance: newOutstanding,
      // A paid-in-full transaction that loses a payment becomes active again.
      status: newOutstanding === 0 ? "PAID_IN_FULL" : "ACTIVE",
      updatedAt: now,
    },
  });

  await tx.auditEvent.create({
    data: {
      actorId: input.actorId ?? null,
      actorName: input.actorName ?? "System",
      action: "payment.void",
      entityType: "payment",
      entityId: payment.id,
      before: { status: "CONFIRMED", amount: payment.amount },
      after: { status: "CANCELLED", amount: payment.amount, reason: input.reason ?? null },
    },
  });

  return { paymentId: payment.id, newTotalPaid, newOutstanding };
}

function formatDMY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}
