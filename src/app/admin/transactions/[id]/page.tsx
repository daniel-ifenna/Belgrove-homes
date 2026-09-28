import { notFound } from "next/navigation";
import StatusBadge from "@/components/admin/StatusBadge";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { redirect } from "next/navigation";
import { formatNaira } from "@/lib/currency";
import { formatDisplayName } from "@/lib/formatName";
import { formatDate, formatDateTime } from "@/lib/booking-ui";
import { getTransactionSummary } from "@/lib/finance";
import ActivitySection from "@/components/admin/ActivitySection";
export const dynamic = "force-dynamic";
import PaymentSchedule from "./PaymentSchedule";
import PaymentVerificationButtons from "./PaymentVerificationButtons";

// Finance display labels (Paid / Late / Partial / Pending) are rendered
// directly from getTransactionSummary — no local status mapping.

// Dates go through the shared Lagos formatter (src/lib/booking-ui.ts) —
 // never server-local toLocaleString.

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) redirect("/admin/login");
  const { id } = await params;
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      paymentPlan: true,
      installments: { orderBy: { installmentNumber: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
      receipts: { orderBy: { issuedAt: "desc" }, include: { sendAttempts: true } },
      booking: { select: { id: true, ref: true } },
    },
  });
  if (!transaction) notFound();

  // Money figures come from the finance service (rule 3) — same numbers as
  // the dashboard and sidebar. Stored columns are display cache only.
  // Detail pages audit any row (includeTest); lists/metrics hide fixtures.
  const summary = await getTransactionSummary(transaction.id, undefined, undefined, { includeTest: true });
  if (!summary) notFound();
  const overdueCount = summary.overdueCount;
  const progress = summary.progressPct.toFixed(2);
  const totalPaid = summary.confirmedPaid;
  const outstanding = summary.outstanding;
  const nextDue = summary.installments.find((i) => i.status !== "Paid");

  return (
    <div className="min-h-screen bg-[var(--ops-bg)]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6">
        <div className="flex items-center gap-2 mono text-[11px] tracking-wide uppercase text-[var(--ops-muted)] mb-4">
          <Link href="/admin/transactions" className="hover:text-[var(--ops-text)] flex items-center gap-1.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg> Transactions</Link>
          <span className="text-[var(--ops-border)]">/</span>
          <span className="text-[var(--ops-text)] font-medium tracking-normal normal-case mono text-[11px]">{transaction.ref}</span>
        </div>

        <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 lg:p-7 shadow-[var(--ops-shadow-sm)]">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            <div className="min-w-0 flex-1">
              <div className="mono text-[11px] tracking-[0.14em] uppercase text-[var(--ops-muted)]">Transaction</div>
              <div className="flex flex-wrap items-baseline gap-3 mt-1">
                <h1 className="font-serif text-[26px] lg:text-[30px] tracking-[-0.02em] text-[var(--ops-text)] leading-none">{transaction.ref}</h1>
                <StatusBadge status={transaction.status} className="px-3 py-1.5 text-xs" />
                {transaction.booking && <Link href={`/admin/bookings/${transaction.booking.id}`} className="mono text-[11px] text-[var(--ops-primary)] hover:underline">Booking {transaction.booking.ref} ↗</Link>}
                {!transaction.booking && transaction.manualReason && <span className="mono text-[11px] text-[var(--ops-muted)]">Manual: {transaction.manualReason}</span>}
              </div>
              <div className="mono text-[11px] text-[var(--ops-muted)] mt-2">Created {formatDateTime(transaction.createdAt)} · {transaction.installments.length} installments · {overdueCount} overdue</div>
            </div>
          </div>

          <div className="mt-6 grid lg:grid-cols-3 gap-6">
            <div className="bg-[var(--ops-bg)] border border-[var(--ops-border)] rounded-xl p-4">
              <div className="mono text-[10px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Client</div>
              <div className="font-medium mt-1">{formatDisplayName(transaction.customerName)}</div>
              <div className="mono text-[12px] text-[var(--ops-muted)]">{transaction.customerEmail}</div>
              {transaction.customerPhone && <div className="mono text-[12px] text-[var(--ops-muted)]">{transaction.customerPhone}</div>}
              <Link href={`/admin/search?q=${encodeURIComponent(transaction.customerEmail)}`} className="mono text-[11px] text-[var(--ops-primary)] hover:underline">Customer ↗</Link>
            </div>
            <div className="bg-[var(--ops-bg)] border border-[var(--ops-border)] rounded-xl p-4">
              <div className="mono text-[10px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Property</div>
              <div className="font-medium mt-1">{transaction.estate} {transaction.unitType ? `· ${transaction.unitType}` : ""}</div>
              <div className="mono text-[12px] text-[var(--ops-muted)]">{transaction.plotCode ?? ""} {transaction.sqm ? `· ${transaction.sqm}sqm` : ""} · {transaction.plotQuantity} plot{transaction.plotQuantity > 1 ? "s" : ""} · {formatNaira(transaction.unitPrice)} each</div>
            </div>
            <div className="bg-[var(--ops-bg)] border border-[var(--ops-border)] rounded-xl p-4">
              <div className="mono text-[10px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Payment Plan</div>
              <div className="font-medium mt-1">{transaction.paymentPlan.name}</div>
              <div className="mono text-[12px] text-[var(--ops-muted)]">{Number(transaction.interestRate) > 0 ? `${Number(transaction.interestRate)}% interest` : "0%"} · {transaction.paymentPlan.initialPaymentPercentage}% initial · {transaction.paymentPlan.remainingInstallments} monthly</div>
            </div>
          </div>

          {/* Summary strip: one place for the money — total · paid · outstanding · progress · next due */}
          <div className="mt-6 bg-[#16281F] rounded-xl p-4 lg:p-5 text-white">
            <div className="grid sm:grid-cols-3 gap-4">
              <div><div className="mono text-[10px] uppercase text-[#D4B368]">Total price</div><div className="price fraunces text-[18px] font-bold mt-1">{formatNaira(transaction.totalPayable)}</div></div>
              <div><div className="mono text-[10px] uppercase text-[#D4B368]">Paid</div><div className="price fraunces text-[18px] font-bold mt-1">{formatNaira(totalPaid)}</div></div>
              <div><div className="mono text-[10px] uppercase text-white">Outstanding</div><div className="price fraunces text-[18px] font-bold mt-1">{formatNaira(outstanding)}</div></div>
            </div>
            <div className="mt-3 h-[6px] rounded-full bg-white/15 overflow-hidden">
              <div className="h-full rounded-full bg-[#D4B368]" style={{ width: `${progress}%` }} />
            </div>
            <div className="mono text-[11px] text-white/70 mt-2">{progress}% paid{nextDue ? ` · Next due: ${nextDue.type === "INITIAL" ? "Initial" : `Month ${nextDue.installmentNumber}`} ${formatNaira(Math.max(0, nextDue.scheduledAmount - nextDue.confirmedPaid))} on ${formatDate(nextDue.dueDate)}` : " · Fully paid"}</div>
          </div>
        </div>

        <div className="mt-6 grid lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
          <div className="space-y-6">
            <PaymentSchedule
              transactionId={transaction.id}
              installments={summary.installments.map((i) => ({
                id: i.id,
                installmentNumber: i.installmentNumber,
                type: i.type,
                dueDate: i.dueDate.toISOString(),
                scheduledAmount: i.scheduledAmount,
                confirmedPaid: i.confirmedPaid,
                pendingTotal: i.pendingTotal,
                status: i.status,
                overdue: i.overdue,
              }))}
              payments={transaction.payments.map((p: any) => ({
                id: p.id,
                installmentId: p.installmentId,
                amount: p.amount,
                paymentDate: new Date(p.paymentDate).toISOString(),
                paymentMethod: p.paymentMethod,
                paymentReference: p.paymentReference,
                bankReference: p.bankReference,
                notes: p.notes,
                status: p.status,
              }))}
              receipts={transaction.receipts.map((r: any) => ({ id: r.id, paymentId: r.paymentId }))}
              outstanding={outstanding}
              totals={{ totalPaid, totalPayable: transaction.totalPayable }}
            />

            <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
              <h2 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Payment History</h2>
              {transaction.payments.length === 0 ? (
                <p className="mono text-[11px] text-[var(--ops-muted)] mt-3">No payments recorded yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {[...transaction.payments]
                    .sort((a: any, b: any) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime())
                    .map((p: any) => {
                    const inst = transaction.installments.find((i: any) => i.id === p.installmentId);
                    const receipt = transaction.receipts.find((r: any) => r.paymentId === p.id);
                    const instLabel = inst ? (inst.type === "INITIAL" ? "Initial payment" : `Month ${inst.installmentNumber}`) : "Payment";
                    return (
                      <div key={p.id} className="flex gap-3 p-3 rounded-xl border border-[var(--ops-border)] bg-[var(--ops-bg)]/30">
                        <div className="h-8 w-8 rounded-full bg-[#0D3328] text-white grid place-items-center text-[11px]">₦</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[13px] font-medium price">{formatNaira(p.amount)}</span>
                            <span className="mono text-[11px] text-[var(--ops-muted)]">{formatDate(p.paymentDate)}</span>
                          </div>
                          <div className="mono text-[11px] text-[var(--ops-muted)]">{instLabel} · {p.paymentMethod ?? "-"}{p.bankReference ? ` · bank: ${p.bankReference}` : ""}{p.notes ? ` · ${p.notes}` : ""}</div>
                          <div className="mono text-[10px] text-[var(--ops-muted)] font-mono">{p.paymentReference}</div>
                          <div className="mt-1.5">
                            <StatusBadge status={p.status} className="px-2 py-0.5 text-[10px]" />
                          </div>
                          {receipt && <div className="mono text-[11px] mt-1"><Link href={`/admin/receipts/${receipt.id}`} className="text-[var(--ops-primary)] hover:underline">Receipt: {receipt.ref}</Link> · {receipt.status}</div>}
                          {p.status === "CONFIRMED" && (
                            <PaymentVerificationButtons
                              transactionId={transaction.id}
                              paymentId={p.id}
                              allowConfirm={false}
                              payment={{ amount: p.amount, installmentLabel: instLabel }}
                              totals={{ totalPaid, totalPayable: transaction.totalPayable }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
              {transaction.receipts.length === 0 ? (
                <p className="mono text-[11px] text-[var(--ops-muted)] mt-3">No receipts yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {transaction.receipts.map((r: any) => (
                    <Link key={r.id} href={`/admin/receipts/${r.id}`} className="block p-3 rounded-xl border border-[var(--ops-border)] hover:bg-[var(--ops-bg)]">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-mono text-[12px] font-medium text-[var(--ops-primary)]">{r.ref}</div>
                        {(r.pdfStatus === "FAILED" || r.emailStatus === "FAILED") && (
                          <span className="mono text-[10px] px-2 py-0.5 rounded-full bg-[#A6402F] text-white">Needs retry →</span>
                        )}
                      </div>
                      <div className="mono text-[11px] text-[var(--ops-muted)]">{formatDate(r.issuedAt)} · {r.status} · {formatNaira(r.finalAmount)}</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <ActivitySection entityType="transaction" entityId={transaction.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
