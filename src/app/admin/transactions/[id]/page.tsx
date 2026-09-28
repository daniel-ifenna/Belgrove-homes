import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { redirect } from "next/navigation";
import { formatNaira } from "@/lib/currency";
import { formatDisplayName } from "@/lib/formatName";
import { getTransactionSummary } from "@/lib/finance";
import ActivitySection from "@/components/admin/ActivitySection";
export const dynamic = "force-dynamic";
import RecordPaymentForm from "./RecordPaymentForm";
import PaymentVerificationButtons from "./PaymentVerificationButtons";

function paymentStatusBadge(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "bg-[#1F6B3E] text-white border-[#1F6B3E]";
    case "PENDING_VERIFICATION":
      return "bg-transparent text-[#8B6B1F] border-[#C89B3C]";
    case "FAILED":
      return "bg-[#A6402F] text-white border-[#A6402F]";
    default:
      return "bg-transparent text-[#6B6252] border-[#D8CFC0]";
  }
}

// Finance display labels (Paid / Late / Partial / Pending) are rendered
// directly from getTransactionSummary — no local status mapping.

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
                <span className={`inline-flex px-3 py-1.5 rounded-full text-xs font-medium border ${transaction.status === "PAID_IN_FULL" ? "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]" : transaction.status === "ACTIVE" ? "bg-[#E0F2F1] text-[#0D3328] border-[#B2DFDB]" : "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]"}`}>{transaction.status.replace("_", " ")}</span>
                {transaction.booking && <Link href={`/admin/bookings/${transaction.booking.id}`} className="mono text-[11px] text-[var(--ops-primary)] hover:underline">Booking {transaction.booking.ref} ↗</Link>}
                {!transaction.booking && transaction.manualReason && <span className="mono text-[11px] text-[var(--ops-muted)]">Manual — {transaction.manualReason}</span>}
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

          <div className="mt-6 grid md:grid-cols-4 gap-4">
            <div className="bg-[#16281F] rounded-xl p-4 text-white">
              <div className="mono text-[10px] uppercase text-[#D4B368]">Base Amount</div><div className="price fraunces text-[16px] font-bold">{formatNaira(transaction.baseAmount)}</div><div className="mono text-[10px] text-white/60">{formatNaira(transaction.unitPrice)} × {transaction.plotQuantity}</div>
            </div>
            <div className="bg-[#16281F] rounded-xl p-4 text-white">
              <div className="mono text-[10px] uppercase text-[#D4B368]">Interest</div><div className="price fraunces text-[16px] font-bold">{formatNaira(transaction.interestAmount)}</div><div className="mono text-[10px] text-white/60">{Number(transaction.interestRate) > 0 ? `${Number(transaction.interestRate)}% one-time` : "0%"}</div>
            </div>
            <div className="bg-[#16281F] rounded-xl p-4 text-white">
              <div className="mono text-[10px] uppercase text-white">Total Payable</div><div className="price fraunces text-[16px] font-bold">{formatNaira(transaction.totalPayable)}</div>
            </div>
            <div className={`rounded-xl p-4 border ${outstanding === 0 ? "bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]" : "bg-white border-[var(--ops-border)] text-[var(--ops-text)]"}`}>
              <div className="mono text-[10px] uppercase text-[var(--ops-muted)]">Outstanding</div><div className="price fraunces text-[16px] font-bold">{formatNaira(outstanding)}</div><div className="mono text-[10px] text-[var(--ops-muted)]">{totalPaid > 0 ? `${progress}% paid` : "No payments yet"}</div>
            </div>
          </div>

          <div className="mt-4 grid md:grid-cols-3 gap-4 mono text-[11px]">
            <div className="bg-[var(--ops-bg)] border border-[var(--ops-border)] rounded-xl p-3"><div className="text-[var(--ops-muted)]">Total Paid</div><div className="font-bold price">{formatNaira(totalPaid)}</div></div>
            <div className="bg-[var(--ops-bg)] border border-[var(--ops-border)] rounded-xl p-3"><div className="text-[var(--ops-muted)]">Outstanding</div><div className="font-bold price">{formatNaira(outstanding)}</div></div>
            <div className="bg-[var(--ops-bg)] border border-[var(--ops-border)] rounded-xl p-3"><div className="text-[var(--ops-muted)]">Progress</div><div className="font-bold">{progress}%</div></div>
          </div>
        </div>

        <div className="mt-6 grid lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
          <div className="space-y-6">
            <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
              <h2 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Payment Schedule</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--ops-bg)]/60 border-b border-[var(--ops-border)] text-left mono text-[10px] uppercase text-[var(--ops-muted)]">
                      <th className="px-3 py-2">Payment</th><th className="px-3 py-2">Due Date</th><th className="px-3 py-2 text-right">Scheduled</th><th className="px-3 py-2 text-right">Paid</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ops-border)]/60">
                    {summary.installments.map((inst) => {
                      const paid = inst.confirmedPaid;
                      const isOverdue = inst.overdue;
                      const statusColor = inst.status === "Paid" ? "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]" : inst.status === "Partial" ? "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]" : isOverdue ? "bg-[#FEF2F2] text-[#9F1239] border-[#FECACA]" : "bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]";
                      // Receipt column rule: link only when a receipt row exists for
                      // this installment (via a CONFIRMED payment). Pending
                      // payments count as nothing — never "Paid", never a link.
                      const confirmedPaymentForInst = transaction.payments.find(
                        (p: any) => p.installmentId === inst.id && p.status === "CONFIRMED"
                      );
                      const receiptLink = confirmedPaymentForInst
                        ? transaction.receipts.find((r: any) => r.paymentId === confirmedPaymentForInst.id)
                        : null;
                      // Fallback: for initial, check if receipt exists for that amount
                      return (
                        <tr key={inst.id} className="hover:bg-[var(--ops-bg)]/30">
                          <td className="px-3 py-2"><span className="font-medium">{inst.type === "INITIAL" ? "Initial" : `Month ${inst.installmentNumber}`}</span><div className="mono text-[10px] text-[var(--ops-muted)]">#{inst.installmentNumber}</div></td>
                          <td className="px-3 py-2 mono text-[11px]">{formatDate(inst.dueDate)}</td>
                          <td className="px-3 py-2 mono text-[11px] text-right price">{formatNaira(inst.scheduledAmount)}</td>
                          <td className="px-3 py-2 mono text-[11px] text-right price">{formatNaira(paid)}</td>
                          <td className="px-3 py-2"><span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-medium border ${statusColor}`}>{inst.status}</span></td>
                          <td className="px-3 py-2 text-right">{receiptLink ? <Link href={`/admin/receipts/${receiptLink.id}`} className="text-xs text-[var(--ops-primary)] hover:underline">View</Link> : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <RecordPaymentForm transactionId={transaction.id} installments={summary.installments.map((i) => ({ ...i, dueDate: i.dueDate.toISOString(), paidAmount: i.confirmedPaid, status: i.status })) as any} outstanding={outstanding} />
            </div>

            <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
              <h2 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Payment History</h2>
              {transaction.payments.length === 0 ? (
                <p className="mono text-[11px] text-[var(--ops-muted)] mt-3">No payments recorded yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {transaction.payments.map((p: any) => {
                    const inst = transaction.installments.find((i: any) => i.id === p.installmentId);
                    const receipt = transaction.receipts.find((r: any) => r.paymentId === p.id);
                    return (
                      <div key={p.id} id={`payment-${p.id}`} className="flex gap-3 p-3 rounded-xl border border-[var(--ops-border)] bg-[var(--ops-bg)]/30 scroll-mt-20">
                        <div className="h-8 w-8 rounded-full bg-[#0D3328] text-white grid place-items-center text-[11px]">₦</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[13px] font-medium price">{formatNaira(p.amount)}</span>
                            <span className="mono text-[11px] text-[var(--ops-muted)]">{formatDate(p.paymentDate)}</span>
                          </div>
                          <div className="mono text-[11px] text-[var(--ops-muted)]">{inst ? `${inst.type === "INITIAL" ? "Initial" : `Month ${inst.installmentNumber}`}` : "Payment"} · {p.paymentMethod ?? "—"}{p.notes ? ` · ${p.notes}` : ""}</div>
                          <div className="mono text-[10px] text-[var(--ops-muted)] font-mono">{(p as any).paymentReference ?? ""}{(p as any).bankReference ? ` · bank: ${(p as any).bankReference}` : ""}</div>
                          <div className="mt-1.5">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${paymentStatusBadge(p.status)}`}>
                              {p.status === "PENDING_VERIFICATION" ? "Pending verification" : p.status.replace("_", " ")}
                            </span>
                          </div>
                          {receipt && <div className="mono text-[11px] mt-1"><Link href={`/admin/receipts/${receipt.id}`} className="text-[var(--ops-primary)] hover:underline">Receipt: {receipt.ref}</Link> · {receipt.status}</div>}
                          {p.status === "PENDING_VERIFICATION" && (
                            <PaymentVerificationButtons transactionId={transaction.id} paymentId={p.id} />
                          )}
                          {p.status === "CONFIRMED" && (
                            <PaymentVerificationButtons transactionId={transaction.id} paymentId={p.id} allowConfirm={false} />
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
