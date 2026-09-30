import fs from "node:fs";
import { prisma } from "@/lib/prisma";
import { sendReceiptEmail } from "@/lib/receipts/emailReceipt";
import { receiptPdfAbsolute, receiptPdfPath, writeReceiptPdf } from "@/lib/receipt-storage";
import { renderReceiptPdfBuffer } from "@/lib/receipt-render";
import { logServerError } from "@/lib/paymentConfirmation";
import type { EmailResult } from "./sendEmail";

// Outbox sender for receipt emails (type "receipt", payload { receiptId }).
// Loads the receipt, reuses the stored PDF (regenerating from the snapshot
// when missing), sends, then records receipt emailStatus + a
// ReceiptSendAttempt audit row (decision a: attempts stay the audit history).
export async function sendReceiptForOutbox(receiptId: string, rowId?: string): Promise<EmailResult> {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: {
      payment: { include: { installment: true } },
      transaction: { select: { totalPayable: true, payments: { where: { status: "CONFIRMED" }, select: { id: true, amount: true, paymentDate: true } } } },
    },
  });
  if (!receipt) return { sent: false, error: "Receipt no longer exists" };

  let pdfBuffer: Buffer | null = null;
  const stored = receipt.pdfPath ? receiptPdfAbsolute(receipt.pdfPath) : null;
  try {
    if (stored && fs.existsSync(stored)) pdfBuffer = fs.readFileSync(stored);
  } catch (e) {
    logServerError(`receipt ${receipt.ref}: cached PDF read failed, regenerating`, e);
  }
  if (!pdfBuffer) {
    try {
      pdfBuffer = await renderReceiptPdfBuffer(receipt.id);
      const pdfPath = receipt.pdfPath ?? receiptPdfPath(receipt.ref);
      // Best-effort cache refresh (serverless /tmp — writable, ephemeral).
      // A cache-write failure must never fail the email: the buffer above
      // is already in memory and is what gets attached.
      try {
        await writeReceiptPdf(pdfPath, pdfBuffer);
      } catch (e) {
        logServerError(`receipt ${receipt.ref}: PDF cache write failed, sending anyway`, e);
      }
      await prisma.receipt.update({
        where: { id: receipt.id },
        data: { pdfStatus: "GENERATED", pdfPath, lastError: null },
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
    result = await sendReceiptEmail({
      to: receipt.recipientEmail,
      clientName: receipt.customerName,
      ref: receipt.ref,
      receiptUrl: receipt.receiptUrl,
      pdfBuffer: pdfBuffer!,
      idempotencyKey: rowId,
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
