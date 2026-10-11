import { prisma } from "@/lib/prisma";
import { generateReceiptPdf } from "@/lib/receipts/generateReceiptPdf";
import { generateQrDataUrl } from "@/lib/receipts/qr";
import { getReceiptAccessUrl } from "@/lib/app-url";

// Single source of truth for rebuilding a receipt PDF from the stored
// snapshot + linked payment/transaction. Used when the filesystem cache
// (ephemeral on serverless — /tmp, never shared between invocations) misses:
// email outbox regen, admin PDF download, and client token PDF download.
//
// Never throws for QR issues (QR is best-effort); throws only when the
// receipt row (or its payment/transaction link) is missing or rendering fails.
export async function renderReceiptPdfBuffer(receiptId: string, opts?: { force?: boolean }): Promise<Buffer> {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: {
      payment: { include: { installment: true } },
      transaction: {
        select: {
          totalPayable: true,
          unitPrice: true,
          plotQuantity: true,
          interestAmount: true,
          paymentPlan: { select: { name: true } },
          payments: {
            where: { status: "CONFIRMED" },
            select: { id: true, amount: true, paymentDate: true },
          },
        },
      },
    },
  });
  if (!receipt) throw new Error("Receipt no longer exists");
  if (!receipt.payment) throw new Error("Receipt has no payment link");

  // Stored bytes win: the PDF was rendered once at confirmation and every
  // send/download reuses those exact bytes (resends never regenerate).
  // Only rows predating stored bytes fall through to render-on-demand, and
  // an explicit force (Regenerate & resend) always rebuilds from the snapshot.
  if (receipt.pdfData && !opts?.force) return Buffer.from(receipt.pdfData);

  // Canonical QR target: derived from this row's own accessToken, never from
  // the stored qrTargetUrl (which can predate an APP_URL change and point at
  // a stale dev origin or another deployment). One receipt → one token → one URL, so
  // a QR can never open a different document. Pre-migration rows without a
  // token fall back to the stored URL so they still render (verify script
  // flags them as BROKEN for backfill).
  const canonicalUrl = receipt.accessToken
    ? getReceiptAccessUrl(receipt.accessToken)
    : (receipt.qrTargetUrl || receipt.receiptUrl);
  if (!canonicalUrl) throw new Error("Receipt has no QR target URL");
  const qr = await generateQrDataUrl(canonicalUrl).catch(() => undefined);
  const previouslyPaid = receipt.transaction
    ? receipt.transaction.payments
        .filter(
          (p) =>
            p.paymentDate < receipt.payment!.paymentDate ||
            (p.paymentDate.getTime() === receipt.payment!.paymentDate.getTime() &&
              p.id < receipt.paymentId)
        )
        .reduce((s, p) => s + p.amount, 0)
    : 0;
  const totalPayable = receipt.transaction?.totalPayable ?? receipt.amountBeforeDiscount;
  const history =
    (receipt.paymentHistory as unknown as { date: string; method: string; amount: number }[] | null) ?? [
      {
        date: receipt.issuedAt.toLocaleDateString("en-GB").split("/").join("-"),
        method: receipt.paymentMethod ?? "Bank Transfer",
        amount: receipt.finalAmount,
      },
    ];

  return generateReceiptPdf({
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
    payments: history,
    receiptUrl: canonicalUrl,
    qrDataUrl: qr,
    unitPrice: receipt.unitPrice ?? receipt.transaction?.unitPrice ?? undefined,
    plotQuantity: receipt.plotQuantity ?? receipt.transaction?.plotQuantity ?? undefined,
    paymentPlanName: receipt.paymentPlanName ?? receipt.transaction?.paymentPlan?.name ?? undefined,
    interestAmount: receipt.transaction?.interestAmount ?? undefined,
    totalPayable,
    previouslyPaid,
    totalPaidAfter: previouslyPaid + receipt.finalAmount,
    outstandingBalance: totalPayable - previouslyPaid - receipt.finalAmount,
    installmentLabel: receipt.payment?.installment
      ? receipt.payment.installment.type === "INITIAL"
        ? "Initial payment"
        : `Month ${receipt.payment.installment.installmentNumber} payment`
      : undefined,
  });
}
