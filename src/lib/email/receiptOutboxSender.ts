import { prisma } from "@/lib/prisma";
import { sendReceiptEmail } from "@/lib/receipts/emailReceipt";
import { renderReceiptPdfBuffer } from "@/lib/receipt-render";
import type { EmailResult } from "./sendEmail";

// Outbox sender for receipt emails (type "receipt", payload { receiptId }).
// The PDF is generated once at payment confirmation and stored on the
// receipt row (pdfData). Sends reuse those stored bytes — they never
// regenerate, so a resend attaches the identical document. Only an explicit
// "Regenerate & resend" (payload { receiptId, regen: true }) rebuilds the
// PDF from the snapshot and stores it first. No filesystem anywhere.
export async function sendReceiptForOutbox(
  receiptId: string,
  rowId?: string,
  opts?: { regen?: boolean; payload?: Record<string, unknown> }
): Promise<EmailResult> {
  const regen = opts?.regen === true || (opts?.payload as { regen?: unknown } | undefined)?.regen === true;
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: {
      payment: { include: { installment: true } },
      transaction: { select: { totalPayable: true, payments: { where: { status: "CONFIRMED" }, select: { id: true, amount: true, paymentDate: true } } } },
    },
  });
  if (!receipt) return { sent: false, error: "Receipt no longer exists" };

  let pdfBuffer: Buffer | null = receipt.pdfData && !regen ? Buffer.from(receipt.pdfData) : null;
  if (!pdfBuffer) {
    try {
      // force:true rebuilds from the snapshot even when stored bytes exist
      // (explicit Regenerate & resend only); plain resends never reach here
      // with bytes present.
      pdfBuffer = await renderReceiptPdfBuffer(receipt.id, regen ? { force: true } : undefined);
      await prisma.receipt.update({
        where: { id: receipt.id },
        data: { pdfStatus: "GENERATED", pdfData: new Uint8Array(pdfBuffer), lastError: null },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 500) : "PDF regenerate failed";
      await prisma.receipt.update({ where: { id: receipt.id }, data: { pdfStatus: "FAILED", lastError: msg } });
      await prisma.receiptSendAttempt.create({
        data: { receiptId: receipt.id, recipientEmail: receipt.recipientEmail, status: "failed", error: msg },
      });
      return { sent: false, error: msg };
    }
  }

  let result: EmailResult;
  try {
    const plotQty = receipt.plotQuantity ?? null;
    const confirmedTotal = (receipt.transaction?.payments ?? []).reduce((s, p) => s + p.amount, 0);
    const isFinalPayment = !!receipt.transaction && confirmedTotal >= receipt.transaction.totalPayable;
    result = await sendReceiptEmail({
      to: receipt.recipientEmail,
      clientName: receipt.customerName,
      ref: receipt.ref,
      receiptUrl: receipt.receiptUrl,
      pdfBuffer: pdfBuffer!,
      idempotencyKey: rowId,
      isFinalPayment,
      plotsSummary:
        plotQty != null
          ? receipt.sqm
            ? `Plots: ${plotQty} × ${receipt.sqm}sqm`
            : `Plots: ${plotQty}`
          : null,
    });
  } catch (e) {
    result = { sent: false, error: e instanceof Error ? e.message : "Email failed" };
  }

  await prisma.receiptSendAttempt.create({
    data: {
      receiptId: receipt.id,
      recipientEmail: receipt.recipientEmail,
      status: result.sent ? "sent" : "failed",
      error: result.error,
    },
  });
  await prisma.auditEvent.create({
    data: {
      actorId: null,
      actorName: "Outbox",
      action: "receipt.send",
      entityType: "receipt",
      entityId: receipt.id,
      before: { emailStatus: "PENDING" },
      after: { sent: result.sent, to: receipt.recipientEmail, error: result.error },
    },
  });
  await prisma.receipt.update({
    where: { id: receipt.id },
    data: {
      status: result.sent ? "sent" : "failed",
      sentAt: result.sent ? new Date() : undefined,
      error: result.sent ? null : result.error,
      emailStatus: result.sent ? "SENT" : "FAILED",
      lastError: result.sent ? null : result.error,
    },
  });
  return result;
}
