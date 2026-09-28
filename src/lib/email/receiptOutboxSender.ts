import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { generateReceiptPdf } from "@/lib/receipts/generateReceiptPdf";
import { generateQrDataUrl } from "@/lib/receipts/qr";
import { sendReceiptEmail } from "@/lib/receipts/emailReceipt";
import { receiptPdfAbsolute, receiptPdfPath } from "@/lib/receipt-storage";
import { logServerError } from "@/lib/paymentConfirmation";
import type { EmailResult } from "./sendEmail";

// Outbox sender for receipt emails (type "receipt", payload { receiptId }).
// Loads the receipt, reuses the stored PDF (regenerating from the snapshot
// when missing), sends, then records receipt emailStatus + a
// ReceiptSendAttempt audit row (decision a: attempts stay the audit history).
export async function sendReceiptForOutbox(receiptId: string): Promise<EmailResult> {
  const receipt = await prisma.receipt.findUnique({ where: { id: receiptId } });
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
      const qr = await generateQrDataUrl(receipt.qrTargetUrl);
      pdfBuffer = generateReceiptPdf({
        ref: receipt.ref,
        issuedDate: receipt.issuedAt.toLocaleDateString("en-GB").split("/").join("-"),
        clientName: receipt.customerName,
        clientAddress: receipt.property,
        clientPhone: receipt.customerPhone ?? "",
        clientEmail: receipt.customerEmail,
        estateName: receipt.estate ?? "",
        unitType: receipt.unitType ?? "",
        plotCode: receipt.plotCode ?? receipt.ref,
        amountPaid: receipt.finalAmount,
        soldPrice: receipt.amountBeforeDiscount,
        discount: receipt.discount || undefined,
        payments: (receipt.paymentHistory as unknown as { date: string; method: string; amount: number }[] | null) ?? [
          {
            date: receipt.issuedAt.toLocaleDateString("en-GB").split("/").join("-"),
            method: receipt.paymentMethod ?? "Bank Transfer",
            amount: receipt.finalAmount,
          },
        ],
        receiptUrl: receipt.receiptUrl,
        qrDataUrl: qr,
      });
      const pdfPath = receipt.pdfPath ?? receiptPdfPath(receipt.ref);
      const abs = receiptPdfAbsolute(pdfPath);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, pdfBuffer);
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
