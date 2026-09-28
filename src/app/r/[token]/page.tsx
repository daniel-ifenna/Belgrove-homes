import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/currency";
import { formatDisplayName } from "@/lib/formatName";
import { receiptAmountsRows } from "@/lib/receipt-amounts";
import { isTokenUsable } from "@/lib/receipt-access";

export const dynamic = "force-dynamic";

function formatDateDMY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// Client-facing receipt page. No login — the unguessable access token in the
// URL is the authorization. Revoked or unknown tokens render notFound.
export default async function ClientReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const receipt = await prisma.receipt.findUnique({
    where: { accessToken: token },
    include: {
      payment: { include: { installment: { select: { type: true, installmentNumber: true } } } },
      transaction: {
        select: {
          totalPayable: true,
          payments: { where: { status: "CONFIRMED" }, select: { id: true, amount: true, paymentDate: true } },
        },
      },
    },
  });
  if (!isTokenUsable(receipt)) {
    notFound();
  }

  const payments = (receipt.paymentHistory as unknown as
    | { date: string; method: string; amount: number }[]
    | null) ?? [
    { date: formatDateDMY(receipt.issuedAt), method: receipt.paymentMethod ?? "Bank Transfer", amount: receipt.finalAmount },
  ];
  const installmentLabel = receipt.payment?.installment
    ? receipt.payment.installment.type === "INITIAL"
      ? "Initial payment"
      : `Month ${receipt.payment.installment.installmentNumber} payment`
    : null;
  const clientPayment = receipt.payment;
  const previouslyPaid =
    receipt.transaction && clientPayment
      ? receipt.transaction.payments
          .filter(
            (p) =>
              p.paymentDate < clientPayment.paymentDate ||
              (p.paymentDate.getTime() === clientPayment.paymentDate.getTime() && p.id < clientPayment.id)
          )
          .reduce((s, p) => s + p.amount, 0)
      : 0;
  const totalPrice = receipt.transaction?.totalPayable ?? receipt.amountBeforeDiscount;
  const paidToDate = previouslyPaid + receipt.finalAmount;

  return (
    <div className="min-h-screen bg-[#F7F2E7] py-8 px-6">
      <div className="max-w-[800px] mx-auto bg-white border border-[#E4DCC7] rounded-xl overflow-hidden shadow-[0_8px_24px_rgba(22,40,31,0.08)]">
        <div className="px-8 pt-8 pb-6 border-b border-[#E4DCC7] flex justify-between gap-6">
          <div>
            <div className="fraunces text-[13px] font-bold tracking-wide text-[#16281F]">BELGROVE HOMES AND PROPERTIES LIMITED</div>
            <div className="mono text-[11px] text-[#6B6656] mt-1">Ste 25, Lebrex Plaza, 47 Ajose Adeogun St, Utako, Abuja 900108, Federal Capital Territory</div>
          </div>
          <div className="mono text-[11px] text-[#16281F] text-right leading-[1.6]">
            <div>www.belgrovehomes.com</div>
            <div>info@belgrovehomes.com</div>
            <div>+234 8103760063</div>
          </div>
        </div>

        <div className="px-8 py-6">
          <div className="flex justify-between items-start pt-2">
            <h1 className="fraunces text-[28px] font-bold text-[#16281F]">RECEIPT</h1>
            <div className="text-right mono text-[11px] text-[#6B6656]">
              <div>RECEIPT: {receipt.ref}</div>
              <div>ISSUED DATE: {formatDateDMY(receipt.issuedAt)}</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-[1.4fr_0.9fr] gap-6">
            <div>
              <div className="mono text-[10px] tracking-[0.12em] uppercase text-[#8B6B4E]">Issued to</div>
              <div className="public text-[14px] font-semibold text-[#16281F] mt-2">{formatDisplayName(receipt.customerName)}</div>
              {receipt.customerPhone && <div className="mono text-[12px] text-[#6B6656] mt-2">{receipt.customerPhone}</div>}
              <div className="mono text-[12px] text-[#6B6656]">{receipt.customerEmail}</div>
            </div>
            <div className="bg-[#C79A46] rounded-lg p-4 text-white">
              {receiptAmountsRows({
                thisPayment: receipt.finalAmount,
                installmentLabel,
                totalPrice,
                paidToDate,
                balanceRemaining: totalPrice - paidToDate,
                discount: receipt.discount,
              }).map((row, i) => (
                <div key={row.key} className={`mono text-[11px] opacity-90 ${i === 0 ? "" : "mt-2"}`}>
                  {i === 0 && <div className="mono text-[10px] tracking-[0.12em] uppercase opacity-90">{row.label}</div>}
                  {i === 0 ? (
                    <div className="fraunces text-[20px] font-bold mt-1">{formatNaira(row.value as number)}</div>
                  ) : (
                    <span>{row.label.toUpperCase()}: {typeof row.value === "number" ? formatNaira(row.value) : row.value}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mono text-[11px] font-bold text-[#16281F] mt-6">{receipt.property}</div>
          {installmentLabel && <div className="mono text-[11px] text-[#6B6656] mt-1">{installmentLabel}</div>}

          <div className="mt-4 border border-[#E4DCC7] rounded-lg overflow-hidden">
            <div className="grid grid-cols-[40px_1fr_1fr_1fr] bg-[#16281F] text-[#D4B368] mono text-[11px] font-medium">
              <div className="px-3 py-2">#</div>
              <div className="px-3 py-2">Payment Date</div>
              <div className="px-3 py-2">Payment Method</div>
              <div className="px-3 py-2 text-right">Amount (₦)</div>
            </div>
            {payments.map((p, i: number) => (
              <div key={i} className={`grid grid-cols-[40px_1fr_1fr_1fr] mono text-[12px] ${i % 2 === 1 ? "bg-[#F7F2E7]" : "bg-white"} border-t border-[#E4DCC7]`}>
                <div className="px-3 py-2">{i + 1}</div>
                <div className="px-3 py-2">{typeof p.date === "string" ? p.date : formatDateDMY(new Date(p.date))}</div>
                <div className="px-3 py-2">{p.method}</div>
                <div className="px-3 py-2 text-right">{formatNaira(p.amount)}</div>
              </div>
            ))}
            <div className="grid grid-cols-[40px_1fr_1fr_1fr] bg-[#16281F] text-[#D4B368] mono text-[12px] font-bold border-t border-[#E4DCC7]">
              <div className="px-3 py-2 col-span-3">Total Paid</div>
              <div className="px-3 py-2 text-right">{formatNaira(receipt.finalAmount)}</div>
            </div>
          </div>

          <div className="mono text-[11px] text-[#6B6656] mt-4">Amount in words:</div>
          <div className="fraunces text-[13px] font-semibold text-[#16281F]">{receipt.amountInWords}</div>

          <p className="public text-[11px] leading-[1.5] text-[#8B6B4E] mt-4 border-t border-[#E4DCC7] pt-4">
            This receipt acknowledges payment as received and reconciled by Belgrove Homes accounts. Property allocation is subject to completion of the agreed payment plan and verification of funds. Keep this receipt safely; present it for allocation and documentation.
          </p>

          <div className="mt-6 flex items-center justify-center">
            <a href={`/api/r/${token}/pdf`} className="mono text-[11px] bg-[#16281F] text-[#F5EFE2] px-4 py-2 rounded-full hover:bg-[#1B2E23]">Download PDF</a>
          </div>
        </div>
      </div>
      <div className="max-w-[800px] mx-auto mt-6 text-center mono text-[11px] text-[#8B6B4E]">
        This page is the stable private URL for receipt <span className="font-medium text-[#16281F]">#{receipt.ref}</span> — the QR code on the PDF points here.
      </div>
    </div>
  );
}
