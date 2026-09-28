import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/currency";
import { formatDisplayName } from "@/lib/formatName";
export const dynamic = "force-dynamic";
import ReceiptActions from "./ReceiptActions";

function formatDate(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function formatDateTime(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function statusBadge(status: string) {
  switch (status) {
    case "sent": return "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]";
    case "failed": return "bg-[#FEF2F2] text-[#9F1239] border-[#FECACA]";
    case "generated": return "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]";
    default: return "bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]";
  }
}

export default async function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      booking: { select: { id: true, ref: true, status: true, location: true } },
      agent: { select: { name: true, email: true } },
      createdBy: { select: { name: true, email: true } },
      sendAttempts: { orderBy: { attemptedAt: "desc" } },
    },
  });
  if (!receipt) notFound();

  const lastSent = receipt.sendAttempts.find((a) => a.status === "sent");
  const attemptsCount = receipt.sendAttempts.length;

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
                <span className={`inline-flex px-3 py-1.5 rounded-full text-xs font-medium border ${statusBadge(receipt.status)}`}>{receipt.status.toUpperCase()}</span>
                {receipt.booking && <Link href={`/admin/bookings/${receipt.booking.id}`} className="mono text-[11px] text-[var(--ops-primary)] hover:underline">View sale ↗</Link>}
              </div>
              <div className="mono text-[11px] text-[var(--ops-muted)] mt-2">Issued {formatDateTime(receipt.issuedAt)} · {attemptsCount} send attempt{attemptsCount !== 1 ? "s" : ""} {lastSent ? `· Last sent ${formatDateTime(lastSent.attemptedAt)}` : ""}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a href={receipt.receiptUrl} target="_blank" className="text-xs bg-white border border-[var(--ops-border)] rounded-full px-4 py-2 hover:bg-[var(--ops-bg)]">View Receipt</a>
              <a href={`/api/receipts/${receipt.ref}/pdf`} target="_blank" className="text-xs bg-[var(--ops-primary)] text-white rounded-full px-4 py-2 hover:bg-[var(--ops-deep)]">Download PDF</a>
            </div>
          </div>
          <ReceiptActions receipt={{ id: receipt.id, ref: receipt.ref, receiptUrl: receipt.receiptUrl, status: receipt.status }} />
        </div>

        <div className="mt-6 grid lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
          <div className="space-y-6">
            <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
              <h2 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Receipt reference</h2>
              <div className="mt-3 font-mono text-[14px] font-medium text-[var(--ops-primary)]">{receipt.ref}</div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Receipt URL</span><a href={receipt.receiptUrl} target="_blank" className="font-mono text-[12px] text-[var(--ops-primary)] hover:underline break-all">{receipt.receiptUrl}</a></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">QR target</span><span className="font-mono text-[12px] break-all">{receipt.qrTargetUrl}</span></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">PDF</span><span className="font-mono text-[12px]">{receipt.pdfPath ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Currency</span><span className="font-medium">{receipt.currency}</span></div>
              </div>
            </div>

            <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
              <h3 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Customer information</h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Name</span><span className="font-medium">{formatDisplayName(receipt.customerName)}</span></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Email</span><span className="font-mono text-[12px] break-all">{receipt.customerEmail}</span></div>
                {receipt.customerPhone && <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Phone</span><span className="font-mono text-[12px]">{receipt.customerPhone}</span></div>}
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Recipient email</span><span className="font-mono text-[12px] break-all">{receipt.recipientEmail}</span></div>
              </div>
            </div>

            <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
              <h3 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Property information</h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Property</span><span className="font-medium break-words max-w-[60%] text-right">{receipt.property}</span></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Estate</span><span className="font-medium">{receipt.estate ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Unit</span><span className="font-medium">{receipt.unitType ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">SKU / Plot Code</span><span className="font-mono text-[12px]">{receipt.plotCode ?? "—"}</span></div>
                {receipt.sqm && <div className="flex justify-between"><span className="text-[var(--ops-muted)]">SQM</span><span className="font-medium">{receipt.sqm}sqm</span></div>}
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Sale / Booking</span>{receipt.bookingId ? <Link href={`/admin/bookings/${receipt.bookingId}`} className="text-[var(--ops-primary)] hover:underline font-mono text-[12px]">{receipt.booking?.ref ?? receipt.bookingId.slice(0, 8)}</Link> : <span className="mono text-[11px] text-[var(--ops-muted)]">Manual — no booking</span>}</div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Source</span><span className={`px-2 py-1 rounded-full text-[11px] font-medium border ${receipt.source === "ADMIN_MANUAL" ? "bg-[#16281F] text-[#D4B368] border-[#16281F]" : "bg-[#E0F2F1] text-[#0D3328] border-[#B2DFDB]"}`}>{receipt.source === "ADMIN_MANUAL" ? "Manual" : "Booking"}</span></div>
              </div>
            </div>

            <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
              <h3 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Payment information</h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Amount before discount</span><span className="font-mono font-medium price">{formatNaira(receipt.amountBeforeDiscount)}</span></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Discount</span><span className="font-mono price">{formatNaira(receipt.discount)}</span></div>
                <div className="flex justify-between border-t border-[var(--ops-border)] pt-2"><span className="font-medium">Final amount paid</span><span className="font-mono font-bold price">{formatNaira(receipt.finalAmount)}</span></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Amount in words</span><span className="text-[12px] text-right max-w-[60%]">{receipt.amountInWords}</span></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Payment description</span><span className="text-[12px] text-right max-w-[60%]">{receipt.paymentDescription}</span></div>
                {receipt.paymentMethod && <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Method</span><span className="font-medium">{receipt.paymentMethod}</span></div>}
                {receipt.agentName && <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Agent / Adviser</span><span className="font-medium">{receipt.agentName}</span></div>}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
              <h3 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Receipt status</h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Status</span><span className={`px-2 py-1 rounded-full text-[11px] font-medium border ${statusBadge(receipt.status)}`}>{receipt.status.toUpperCase()}</span></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Issued</span><span className="font-mono text-[12px]">{formatDateTime(receipt.issuedAt)}</span></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Sent</span><span className="font-mono text-[12px]">{receipt.sentAt ? formatDateTime(receipt.sentAt) : "—"}</span></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Recipient</span><span className="font-mono text-[12px] break-all">{receipt.recipientEmail}</span></div>
                <div className="flex justify-between"><span className="text-[var(--ops-muted)]">Created by</span><span className="text-[12px]">{receipt.createdBy?.name ?? receipt.createdBy?.email ?? "—"}</span></div>
                {receipt.error && <div className="mt-2 p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 break-words">Error: {receipt.error}</div>}
              </div>
              <div className="mt-4 pt-4 border-t border-[var(--ops-border)]">
                <div className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">PDF preview</div>
                <a href={`/api/receipts/${receipt.ref}/pdf`} target="_blank" className="mt-2 block rounded-xl border border-[var(--ops-border)] bg-[var(--ops-bg)] p-4 text-center hover:bg-white">
                  <div className="mono text-[11px] text-[var(--ops-muted)]">View / Download PDF</div>
                  <div className="font-mono text-[12px] font-medium text-[var(--ops-primary)] mt-1">{receipt.ref}.pdf</div>
                </a>
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
                          <span className="text-[12px] font-medium capitalize">{a.status} → {a.recipientEmail}</span>
                          <span className="mono text-[11px] text-[var(--ops-muted)]">{formatDateTime(a.attemptedAt)}</span>
                        </div>
                        {a.actorName && <div className="mono text-[11px] text-[var(--ops-muted)]">by {a.actorName}</div>}
                        {a.error && <div className="text-[11px] text-red-700 mt-1 break-words">Error: {a.error}</div>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <div className="mono text-[10px] text-[var(--ops-muted)] mt-3">Last sent: {lastSent ? formatDateTime(lastSent.attemptedAt) : "—"} · Attempts: {attemptsCount} · Last status: {receipt.status}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
