import { prisma } from "@/lib/prisma";
import { generateReceiptPdf } from "@/lib/receipts/generateReceiptPdf";
import { generateQrDataUrl } from "@/lib/receipts/qr";

// Single source of truth for rebuilding a receipt PDF from the stored
// snapshot + linked payment/transaction. Used when the filesystem cache
// (ephemeral on serverless — /tmp, never shared between invocations) misses:
// email outbox regen, admin PDF download, and client token PDF download.
//
// Never throws for QR issues (QR is best-effort); throws only when the
// receipt row (or its payment/transaction link) is missing or rendering fails.
export async function renderReceiptPdfBuffer(receiptId: string): Promise<Buffer> {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: {
      payment: { include: { installment: true } },
      transaction: {
        select: {
          totalPayable: true,
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

  const qr = await generateQrDataUrl(receipt.qrTargetUrl).catch(() => undefined);
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
    receiptUrl: receipt.receiptUrl,
    qrDataUrl: qr,
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
