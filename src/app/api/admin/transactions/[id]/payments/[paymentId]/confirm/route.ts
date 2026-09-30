import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { generateUniqueReceiptRef } from "@/lib/ref";
import { getAppUrl, getReceiptAccessUrl, generateReceiptAccessToken } from "@/lib/app-url";
import { receiptPdfPath, writeReceiptPdf } from "@/lib/receipt-storage";
import { generateReceiptPdf } from "@/lib/receipts/generateReceiptPdf";
import { generateQrDataUrl } from "@/lib/receipts/qr";
import {
  applyConfirmationDbUnit,
  toUserFacingError,
  logServerError,
  PaymentAlreadyHandledError,
  OverScheduleError,
} from "@/lib/paymentConfirmation";
import { generateAndStoreReceiptPdf } from "@/lib/receiptDelivery";

// The inline outbox send runs after the response; allow headroom for the
// request's own DB work plus the post-response SMTP send (Hobby max: 300s).
export const maxDuration = 30;

function formatDateDMY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string; paymentId: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, paymentId } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const verificationNotes = body?.verificationNotes ?? null;

  // Pre-transaction reads: snapshot for the PDF + receipt reference. The
  // transaction itself re-validates everything authoritatively.
  const preview = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { transaction: { include: { installments: true, paymentPlan: true } }, installment: true },
  });
  if (!preview || preview.transactionId !== id) {
    return NextResponse.json({ error: "Payment not found for this transaction." }, { status: 404 });
  }
  if (preview.status !== "PENDING_VERIFICATION") {
    return NextResponse.json(
      { error: "This payment is no longer pending. Refresh to see the latest state." },
      { status: 409 }
    );
  }

  let receiptRef: string;
  try {
    receiptRef = await generateUniqueReceiptRef();
  } catch (e) {
    logServerError("confirm payment: ref generation failed", e);
    return NextResponse.json({ error: "Couldn't confirm payment. Please try again." }, { status: 500 });
  }

  // Fail fast when APP_URL is missing in production (getAppUrl throws).
  try {
    getAppUrl();
  } catch (e) {
    // Actionable config message, no internals — safe to surface.
    logServerError("confirm payment: missing base URL", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Site URL is not configured." },
      { status: 500 }
    );
  }
  const accessToken = generateReceiptAccessToken();
  const receiptUrl = getReceiptAccessUrl(accessToken);
  const pdfPath = receiptPdfPath(receiptRef);

  // DB-ONLY transaction: claim payment → installment → totals → receipt row
  // (delivery PENDING). No PDF, no fs, no email in here.
  let confirmed;
  try {
    confirmed = await prisma.$transaction(
        async (tx) =>
        applyConfirmationDbUnit(tx, {
          paymentId,
          transactionId: id,
          confirmedById: session!.user.id,
          confirmedByName: session!.user.name ?? session!.user.email ?? "System",
          verificationNotes,
          receiptRef,
          receiptUrl,
          qrTargetUrl: receiptUrl,
          pdfPath,
          accessToken,
        }),
      { maxWait: 5000, timeout: 10000 }
    );
  } catch (e) {
    logServerError(`confirm payment ${paymentId}`, e);
    if (e instanceof PaymentAlreadyHandledError) {
      return NextResponse.json({ error: toUserFacingError(e, "confirm") }, { status: 409 });
    }
    if (e instanceof OverScheduleError) {
      return NextResponse.json({ error: toUserFacingError(e, "confirm") }, { status: 400 });
    }
    return NextResponse.json({ error: toUserFacingError(e, "confirm") }, { status: 500 });
  }

  // ---- Post-commit side effects (recoverable; never roll back the above) ----
  const txn = preview.transaction;
  const issuedDateStr = formatDateDMY(confirmed.payment.paymentDate);
  const previouslyPaid = confirmed.newTotalPaid - confirmed.payment.amount;

  const qrDataUrl = await generateQrDataUrl(receiptUrl).catch((e) => {
    logServerError(`receipt ${receiptRef}: QR generation failed`, e);
    return undefined;
  });

  const pdfOutcome = await generateAndStoreReceiptPdf({
    db: prisma,
    receiptId: confirmed.receiptId,
    ref: receiptRef,
    pdfPath,
    render: () =>
      generateReceiptPdf({
        ref: receiptRef,
        issuedDate: issuedDateStr,
        clientName: txn.customerName,
        clientAddress: `${txn.estate} · ${txn.unitType ?? "Plot"} · ${txn.plotCode ?? txn.ref}`,
        clientPhone: txn.customerPhone ?? "",
        clientEmail: txn.customerEmail,
        estateName: txn.estate,
        unitType: txn.unitType ?? "Plot",
        plotCode: txn.plotCode ?? txn.ref,
        amountPaid: confirmed.payment.amount,
        soldPrice: txn.baseAmount,
        discount: 0,
        payments: [
          {
            date: issuedDateStr,
            method: confirmed.payment.paymentMethod ?? "Bank Transfer",
            amount: confirmed.payment.amount,
          },
        ],
        receiptUrl,
        qrDataUrl,
        unitPrice: txn.unitPrice,
        plotQuantity: txn.plotQuantity,
        paymentPlanName: txn.paymentPlan?.name,
        interestAmount: txn.interestAmount,
        totalPayable: txn.totalPayable,
        previouslyPaid,
        totalPaidAfter: confirmed.newTotalPaid,
        outstandingBalance: confirmed.newOutstanding,
        transactionRef: txn.ref,
        installmentLabel: confirmed.installment
          ? confirmed.installment.type === "INITIAL"
            ? "Initial payment"
            : `Month ${confirmed.installment.installmentNumber} payment`
          : undefined,
      }),
    writeFile: (filePath, buf) => writeReceiptPdf(filePath, buf),
  });

  if (!pdfOutcome.ok) {
    try {
      await prisma.receipt.update({
        where: { id: confirmed.receiptId },
        data: { emailStatus: "FAILED", lastError: "Skipped: PDF generation failed" },
      });
    } catch (e) {
      logServerError(`receipt ${receiptRef}: failed to mark email skipped`, e);
    }
    try {
      await prisma.receiptSendAttempt.create({
        data: {
          receiptId: confirmed.receiptId,
          recipientEmail: txn.customerEmail,
          status: "failed",
          error: pdfOutcome.error,
          actorId: session!.user.id,
          actorName: session!.user.name ?? session!.user.email ?? "Unknown",
        },
      });
    } catch (e) {
      logServerError(`receipt ${receiptRef}: failed to log send attempt`, e);
    }
    return NextResponse.json({
      receipt: { id: confirmed.receiptId, ref: receiptRef },
      emailResult: { sent: false, error: pdfOutcome.error },
      warning: "Payment confirmed, but the receipt PDF failed. Retry from the receipt page.",
    });
  }

  // The receipt email was queued inside the confirmation transaction
  // (committed above): inline-send it after the response, never blocking SMTP.
  const { scheduleInlineOutboxSend } = await import("@/lib/email/outbox");
  scheduleInlineOutboxSend([confirmed.outboxId]);

  return NextResponse.json({
    receipt: { id: confirmed.receiptId, ref: receiptRef },
    emailQueued: true,
  });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string; paymentId: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, paymentId } = await ctx.params;
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { receipt: true, installment: true, transaction: true } });
  if (!payment || payment.transactionId !== id) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  return NextResponse.json({ payment });
}
