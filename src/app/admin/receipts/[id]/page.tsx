import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { redirect } from "next/navigation";
import StatusBadge from "@/components/admin/StatusBadge";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/currency";
import { formatDisplayName } from "@/lib/formatName";
import { formatDateTime } from "@/lib/booking-ui";
import { receiptAmountsRows } from "@/lib/receipt-amounts";
import ActivitySection from "@/components/admin/ActivitySection";
export const dynamic = "force-dynamic";
import ReceiptActions from "./ReceiptActions";

// Dates go through the shared Lagos formatter (src/lib/booking-ui.ts).
export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) redirect("/admin/login");
  const { id } = await params;
  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      booking: { select: { id: true, ref: true, status: true, location: true } },
      payment: { select: { id: true, paymentReference: true, amount: true, paymentDate: true, installment: { select: { type: true, installmentNumber: true } } } },
      transaction: {
        select: {
          id: true, ref: true, bookingId: true, manualReason: true, totalPayable: true,
          booking: { select: { id: true, ref: true } },
          payments: { where: { status: "CONFIRMED" }, select: { id: true, amount: true, paymentDate: true } },
        },
      },
      agent: { select: { name: true, email: true } },
      createdBy: { select: { name: true, email: true } },
      sendAttempts: { orderBy: { attemptedAt: "desc" } },
    },
  });
  if (!receipt) notFound();

  const lastSent = receipt.sendAttempts.find((a) => a.status === "sent");
  const attemptsCount = receipt.sendAttempts.length;

  // As-of-issue figures: confirmed payments strictly before this one.
  const receiptPayment = receipt.payment;
  const previouslyPaid = receipt.transaction && receiptPayment
    ? receipt.transaction.payments
        .filter(
          (p) =>
            p.paymentDate < receiptPayment.paymentDate ||
            (p.paymentDate.getTime() === receiptPayment.paymentDate.getTime() && p.id < receiptPayment.id)
        )
        .reduce((s, p) => s + p.amount, 0)
    : 0;
  const paidToDate = previouslyPaid + receipt.finalAmount;
  const balanceRemaining = (receipt.transaction?.totalPayable ?? receipt.amountBeforeDiscount) - paidToDate;
  const installmentLabel = receipt.payment?.installment
    ? receipt.payment.installment.type === "INITIAL"
      ? "Initial payment"
      : `Month ${receipt.payment.installment.installmentNumber} payment`
    : null;
  const outbox = await prisma.emailOutbox.findMany({
    where: { type: "receipt", relatedId: receipt.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, status: true, attempts: true, lastError: true, createdAt: true, provider: true, providerMessageId: true },
  });

  return (
    <div className="min-h-screen bg-[var(--ops-bg)]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6">
        <div className="flex items-center gap-2 mono text-[11px] tracking-wide uppercase text-[var(--ops-muted)] mb-4">
          <Link href="/admin/receipts" className="hover:text-[var(--ops-text)] flex items-center gap-1.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg> Receipts</Link>
          <span className="text-[var(--ops-border)]">/</span>
          <span className="text-[var(--ops-text)] font-medium tracking-normal normal-case mono text-[11px]">{receipt.ref}</span>
        </div>

        <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 lg:p-7 shadow-[var(--ops-shadow-sm)]">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            <div className="min-w-0 flex-1">
              <div className="mono text-[11px] tracking-[0.14em] uppercase text-[var(--ops-muted)]">Receipt</div>
              <div className="flex flex-wrap items-baseline gap-3 mt-1">
                <h1 className="font-serif text-[26px] lg:text-[30px] tracking-[-0.02em] text-[var(--ops-text)] leading-none">{receipt.ref}</h1>
                <StatusBadge status={receipt.status} className="px-3 py-1.5 text-xs" />
              </div>
              <div className="mono text-[11px] text-[var(--ops-muted)] mt-2">Issued {formatDateTime(receipt.issuedAt)} · {attemptsCount} send attempt{attemptsCount !== 1 ? "s" : ""} {lastSent ? `· Last sent ${formatDateTime(lastSent.attemptedAt)}` : ""}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ReceiptActions
                receipt={{ id: receipt.id, ref: receipt.ref, receiptUrl: receipt.receiptUrl, status: receipt.status }}
                pdfHref={`/api/admin/receipts/${receipt.id}/pdf`}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 grid lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
          <div className="space-y-6">
            <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
              <h2 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Amounts</h2>
              <div className="mt-3 space-y-2 text-sm">
                {receiptAmountsRows({
                  thisPayment: receipt.finalAmount,
                  installmentLabel,
                  totalPrice: receipt.transaction?.totalPayable ?? receipt.amountBeforeDiscount,
                  paidToDate,
                  balanceRemaining,
                  discount: receipt.discount,
                }).map((row) => (
                  <div
                    key={row.key}
                    className={`flex justify-between ${row.key === "balance" ? "border-t border-[var(--ops-border)] pt-2" : ""}`}
                  >
                    <span className={row.key === "balance" ? "font-medium" : "text-[var(--ops-muted)]"}>{row.label}</span>
                    <span className={`font-mono price ${row.emphasize ? "font-bold" : ""}`}>{typeof row.value === "number" ? formatNaira(row.value) : row.value}</span>
                  </div>
                ))}
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Amount in words</span><span className="text-[12px] text-right max-w-[60%]">{receipt.amountInWords}</span></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Description</span><span className="text-[12px] text-right max-w-[60%]">{receipt.paymentDescription}</span></div>
                {receipt.paymentMethod && <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Method</span><span className="font-medium">{receipt.paymentMethod}</span></div>}
              </div>
            </div>

            <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
              <h2 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Links</h2>
              <div className="mt-3 space-y-2 text-sm">
                {receipt.payment && <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Payment</span><Link href={`/admin/transactions/${receipt.transactionId}#payment-${receipt.payment.id}`} className="font-mono text-[12px] text-[var(--ops-primary)] hover:underline">{receipt.payment.paymentReference}</Link></div>}
                {receipt.transaction && <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Transaction</span><Link href={`/admin/transactions/${receipt.transaction.id}`} className="font-mono text-[12px] text-[var(--ops-primary)] hover:underline">{receipt.transaction.ref}</Link></div>}
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Sale / Booking</span>{receipt.transaction?.booking ? <Link href={`/admin/bookings/${receipt.transaction.booking.id}`} className="text-[var(--ops-primary)] hover:underline font-mono text-[12px]">{receipt.transaction.booking.ref}</Link> : receipt.transaction?.manualReason ? <span className="mono text-[11px] text-[var(--ops-muted)]">Manual: {receipt.transaction.manualReason}</span> : receipt.bookingId ? <Link href={`/admin/bookings/${receipt.bookingId}`} className="text-[var(--ops-primary)] hover:underline font-mono text-[12px]">{receipt.booking?.ref ?? receipt.bookingId}</Link> : <span className="mono text-[11px] text-[var(--ops-muted)]">Manual: no booking</span>}</div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Customer</span><Link href={`/admin/search?q=${encodeURIComponent(receipt.customerEmail)}`} className="font-medium text-[var(--ops-primary)] hover:underline">{formatDisplayName(receipt.customerName)}</Link></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Client receipt page</span><a href={receipt.receiptUrl} target="_blank" className="font-mono text-[12px] text-[var(--ops-primary)] hover:underline break-words">Open ↗</a></div>
                {receipt.agentName && <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Agent / Adviser</span><span className="font-medium">{receipt.agentName}</span></div>}
              </div>
            </div>

            <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
              <h3 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Property</h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Property</span><span className="font-medium break-words max-w-[60%] text-right">{receipt.property}</span></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Estate</span><span className="font-medium">{receipt.estate ?? "-"}</span></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Unit</span><span className="font-medium">{receipt.unitType ?? "-"}</span></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">SKU / Plot Code</span><span className="font-mono text-[12px]">{receipt.plotCode ?? "-"}</span></div>
                {receipt.sqm && <div className="flex justify-between"><span className="text-[var(--ops-muted)]">SQM</span><span className="font-medium">{receipt.sqm}sqm</span></div>}
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Source</span><StatusBadge status={receipt.source} /></div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
              <h3 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Receipt status</h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Status</span><StatusBadge status={receipt.status} /></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Issued</span><span className="font-mono text-[12px]">{formatDateTime(receipt.issuedAt)}</span></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Sent</span><span className="font-mono text-[12px]">{receipt.sentAt ? formatDateTime(receipt.sentAt) : "-"}</span></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Recipient</span><span className="font-mono text-[12px] break-words">{receipt.recipientEmail}</span></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Created by</span><span className="text-[12px]">{receipt.createdBy?.name ?? receipt.createdBy?.email ?? "-"}</span></div>
                {receipt.error && <div className="mt-2 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 break-words">Error: {receipt.error}</div>}
                {outbox.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[var(--ops-border)]">
                    <div className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">Delivery queue</div>
                    {outbox.map((o) => (
                      <div key={o.id} className="mono text-[11px] text-[var(--ops-muted)] mt-1 flex justify-between gap-2">
                        <StatusBadge status={o.status} className="px-2 py-0.5 text-[10px]" />
                        <span className="text-right break-words">
                          {o.attempts} attempt{o.attempts === 1 ? "" : "s"}
                          {o.provider ? ` · via ${o.provider}` : ""}
                          {o.providerMessageId ? ` · id ${o.providerMessageId}` : ""}
                          {o.lastError ? ` · ${o.lastError.slice(0, 60)}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
              <h3 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Send history</h3>
              {receipt.sendAttempts.length === 0 ? (
                <p className="mono text-[11px] text-[var(--ops-muted)] mt-3">No send attempts recorded.</p>
              ) : (
                <ol className="mt-3 space-y-2">
                  {receipt.sendAttempts.map((a) => (
                    <li key={a.id} className="flex gap-3 p-2.5 rounded-xl border border-[var(--ops-border)] bg-[var(--ops-bg)]/50">
                      <span className={`h-6 w-6 rounded-full grid place-items-center text-[10px] shrink-0 ${a.status === "sent" ? "bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]" : a.status === "failed" ? "bg-[#FEF2F2] text-[#9F1239] border border-[#FECACA]" : "bg-[#FFFBEB] text-[#92400E] border"}`}>{a.status === "sent" ? "✓" : a.status === "failed" ? "✕" : "…"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[12px] font-medium"><span className="capitalize">{a.status}</span> → <span className="font-mono normal-case">{a.recipientEmail}</span></span>
                          <span className="mono text-[11px] text-[var(--ops-muted)]">{formatDateTime(a.attemptedAt)}</span>
                        </div>
                        {a.actorName && <div className="mono text-[11px] text-[var(--ops-muted)]">by {a.actorName}</div>}
                        {a.error && <div className="text-[11px] text-red-700 mt-1 break-words">Error: {a.error}</div>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <div className="mono text-[10px] text-[var(--ops-muted)] mt-3">Last sent: {lastSent ? formatDateTime(lastSent.attemptedAt) : "-"} · Attempts: {attemptsCount} · Last status: {receipt.status}</div>
            </div>
            <div className="mt-6">
              <ActivitySection entityType="receipt" entityId={receipt.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
