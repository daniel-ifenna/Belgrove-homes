import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { generateReceiptPdf } from "@/lib/receipts/generateReceiptPdf";
import { generateQrDataUrl } from "@/lib/receipts/qr";
import { sendReceiptEmail } from "@/lib/receipts/emailReceipt";
import { logServerError } from "@/lib/paymentConfirmation";
import { receiptPdfAbsolute, receiptPdfPath } from "@/lib/receipt-storage";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const receipt = await prisma.receipt.findUnique({ where: { id }, include: { booking: true } });
  if (!receipt) return NextResponse.json({ error: "Receipt not found" }, { status: 404 });

  // Reuse same ref, same receipt record — do not create new receipt number
  // Regenerate PDF to ensure QR and data are current (or reuse existing file if present)
  let pdfBuffer: Buffer | null = null;
  const pdfPath = receiptPdfAbsolute(receipt.pdfPath ?? receiptPdfPath(receipt.ref));
  try {
    if (fs.existsSync(pdfPath)) {
      pdfBuffer = fs.readFileSync(pdfPath);
    }
  } catch (e) {
    logServerError(`receipt ${receipt.ref}: cached PDF read failed, regenerating`, e);
  }

  if (!pdfBuffer) {
    // Regenerate from receipt snapshot + booking
    try {
      const qr = await generateQrDataUrl(receipt.qrTargetUrl);
      pdfBuffer = generateReceiptPdf({
        ref: receipt.ref,
        issuedDate: new Date(receipt.issuedAt).toLocaleDateString("en-GB").split("/").join("-"),
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
        payments: (receipt.paymentHistory as unknown as
          | { date: string; method: string; amount: number }[]
          | null) ?? [{ date: new Date().toLocaleDateString("en-GB").split("/").join("-"), method: receipt.paymentMethod ?? "Bank Transfer", amount: receipt.finalAmount }],
        receiptUrl: receipt.receiptUrl,
        qrDataUrl: qr,
      });
      const outDir = path.join(process.cwd(), "storage", "receipts");
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(pdfPath, pdfBuffer);
      await prisma.receipt.update({
        where: { id: receipt.id },
        data: { pdfStatus: "GENERATED", pdfPath: receipt.pdfPath ?? receiptPdfPath(receipt.ref), lastError: null },
      });
    } catch (e) {
      logServerError(`receipt ${receipt.ref}: PDF regenerate failed`, e);
      await prisma.receipt.update({
        where: { id: receipt.id },
        data: { pdfStatus: "FAILED", lastError: e instanceof Error ? e.message.slice(0, 500) : "PDF regenerate failed" },
      });
      return NextResponse.json({ error: "Couldn't regenerate the receipt PDF. Please try again." }, { status: 500 });
    }
  }

  const actorId = session!.user.id;
  const actorName = session!.user.name ?? session!.user.email ?? "Unknown";
  let emailResult: { sent: boolean; error: string | null } = { sent: false, error: null };
  try {
    emailResult = await sendReceiptEmail({
      to: receipt.recipientEmail,
      clientName: receipt.customerName,
      ref: receipt.ref,
      receiptUrl: receipt.receiptUrl,
      pdfBuffer: pdfBuffer!,
    });
  } catch (e) {
    emailResult = { sent: false, error: e instanceof Error ? e.message : "Email failed" };
  }

  const attemptStatus = emailResult.sent ? "sent" : "failed";
  await prisma.receiptSendAttempt.create({
    data: {
      receiptId: receipt.id,
      recipientEmail: receipt.recipientEmail,
      status: attemptStatus,
      error: emailResult.error,
      actorId,
      actorName,
    },
  });

  const updated = await prisma.receipt.update({
    where: { id: receipt.id },
    data: {
      status: emailResult.sent ? "sent" : "failed",
      sentAt: emailResult.sent ? new Date() : receipt.sentAt,
      error: emailResult.error,
      emailStatus: emailResult.sent ? "SENT" : "FAILED",
      lastError: emailResult.sent ? null : emailResult.error,
    },
  });

  if (!emailResult.sent) {
    logServerError(`receipt ${receipt.ref}: resend failed`, emailResult.error);
    return NextResponse.json({ error: "Couldn't resend the receipt. Please try again.", receipt: updated, emailResult }, { status: 502 });
  }

  return NextResponse.json({ receipt: updated, emailResult });
}
