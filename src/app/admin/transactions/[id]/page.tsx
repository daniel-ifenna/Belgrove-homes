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
import { formatDateDMY } from "@/lib/time";
import { getTransactionSummary } from "@/lib/finance";
import ActivitySection from "@/components/admin/ActivitySection";
export const dynamic = "force-dynamic";
import PaymentSchedule from "./PaymentSchedule";
import PaymentVerificationButtons from "./PaymentVerificationButtons";
import CorrectPaymentDialog from "./CorrectPaymentDialog";
import ReconcileButton from "./ReconcileButton";
import CorrectionsPanel from "./CorrectionsPanel";
import StatementsPanel from "./StatementsPanel";
import TruncatedNote from "./TruncatedNote";
import { buildStatementRows } from "@/lib/statement";
import { buildStatementModel } from "@/lib/statement-model";
import { statementFmt } from "@/lib/statement-pdf";
import { planAllocationCapped } from "@/lib/finance/ledger";
import { appliedToLabel, installmentAppliedLabel } from "@/lib/receipt-amounts";

// Finance display labels (Paid / Late / Partial / Pending) are rendered
// directly from getTransactionSummary — no local status mapping.

// Dates go through the shared Lagos formatter (src/lib/booking-ui.ts) —
 // never server-local toLocaleString.

export default async function TransactionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ history?: string }>;
}) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) redirect("/admin/login");
  const { id } = await params;
  const showAll = (await searchParams)?.history === "all";
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      paymentPlan: true,
      installments: { orderBy: { installmentNumber: "asc" } },
      payments: {
        orderBy: { createdAt: "desc" },
        include: {
          allocations: { include: { installment: { select: { installmentNumber: true, type: true, scheduledAmount: true } } } },
        },
      },
      receipts: { orderBy: { issuedAt: "desc" }, omit: { pdfData: true }, include: { replacedBy: { select: { id: true, ref: true } } } },
      booking: { select: { id: true, ref: true } },
      ledgerEntries: {
        orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }],
        include: { payment: { select: { paymentReference: true } } },
      },
      statements: { orderBy: { createdAt: "desc" }, omit: { pdfData: true } },
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

  // Payment History data: effective entries (superseded excluded unless the
  // toggle is on), oldest first. Allocations come from the stored rows.
  const allPayments = [...transaction.payments].sort(
    (a: any, b: any) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
  );
  const effectivePayments = allPayments.filter((p: any) => p.status !== "CANCELLED");
  const supersededPayments = allPayments.filter((p: any) => p.status === "CANCELLED");
  const listedPayments = showAll ? allPayments : effectivePayments;
  const confirmedSum = effectivePayments
    .filter((p: any) => p.status === "CONFIRMED")
    .reduce((s: number, p: any) => s + p.amount, 0);
  const correctAudits = await prisma.auditEvent.findMany({
    where: { entityId: { in: transaction.payments.map((p: any) => p.id) }, action: "payment.correct" },
    select: { entityId: true, actorName: true, createdAt: true, after: true },
  });
  const correctAuditByPayment = new Map(correctAudits.map((a) => [a.entityId, a]));

  const instLabelOf = (n: number, type: string) => installmentAppliedLabel(n, type);
  // "Applied to" from allocation rows; pending payments preview through the
  // same waterfall the confirm step will run.
  const appliedTo = (p: any): string => {
    if (p.allocations && p.allocations.length > 0) {
      const byInst = new Map<string, { installmentNumber: number; type: string; amount: number; scheduled: number }>();
      for (const a of p.allocations) {
        const cur = byInst.get(a.installmentId) ?? {
          installmentNumber: a.installment.installmentNumber,
          type: a.installment.type,
          amount: 0,
          scheduled: a.installment.scheduledAmount,
        };
        cur.amount += a.amount;
        byInst.set(a.installmentId, cur);
      }
      return appliedToLabel(
        [...byInst.values()].map((v) => ({
          installmentNumber: v.installmentNumber,
          type: v.type,
          amount: v.amount,
          scheduledAmount: v.scheduled,
        }))
      );
    }
    if (p.status === "PENDING_VERIFICATION") {
      try {
        const { plan } = planAllocationCapped(
          transaction.installments.map((i: any) => ({ id: i.id, installmentNumber: i.installmentNumber, scheduledAmount: i.scheduledAmount, paidAmount: summary.installments.find((s) => s.id === i.id)?.confirmedPaid ?? 0 })),
          null,
          p.amount
        );
        if (plan.length === 0) return "No schedule capacity (credit?)";
        return `Will apply to ${plan
          .map((s) => {
            const inst = transaction.installments.find((i: any) => i.id === s.installmentId) ?? {
              installmentNumber: -1,
              type: "MONTHLY",
            };
            return `${instLabelOf(inst.installmentNumber, inst.type)} ${formatNaira(s.amount)}`;
          })
          .join(", ")}`;
      } catch {
        return "Exceeds schedule — needs explicit credit";
      }
    }
    return "—";
  };
  // Next-due from the shared helper (carry-forward aware), not a local find.
  const nextDue = summary.nextInstallment;
  const nextDueDays =
    summary.daysOverdue !== null && summary.daysOverdue !== undefined
      ? `Overdue by ${summary.daysOverdue} day${summary.daysOverdue === 1 ? "" : "s"}`
      : summary.daysUntilDue === 0
        ? "due today"
        : summary.daysUntilDue === 1
          ? "due tomorrow"
          : summary.daysUntilDue !== null && summary.daysUntilDue !== undefined
            ? `in ${summary.daysUntilDue} days`
            : null;

  // Statement preview from the SAME line model as the PDF
  // (buildStatementModel: ledger service only, contract fallback, shared
  // ordering, exclusions) with the SAME formatters — page and PDF can never
  // disagree. The internal table below shows the full unfiltered ledger.
  const preview = await buildStatementModel(prisma as never, { transactionId: transaction.id, draft: true });

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
              <div><div className="mono text-[10px] uppercase text-white">Outstanding</div><div className="price fraunces text-[18px] font-bold mt-1">{outstanding < 0 ? `Credit ${formatNaira(-outstanding)}` : formatNaira(outstanding)}</div></div>
            </div>
            <div className="mt-3 h-[6px] rounded-full bg-white/15 overflow-hidden">
              <div className="h-full rounded-full bg-[#D4B368]" style={{ width: `${Math.min(100, Number(progress))}%` }} />
            </div>
            <div className="mono text-[11px] text-white/70 mt-2">{progress}% paid{nextDue ? ` · Next due: ${nextDue.type === "INITIAL" ? "Initial" : `Month ${nextDue.number}`} ${formatNaira(nextDue.amountDue)} on ${formatDate(nextDue.dueDate)}${nextDueDays ? ` · ${nextDueDays}` : ""}` : " · Fully paid"}</div>
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
                isCredit: p.isCredit ?? false,
                creditAmount: p.creditAmount ?? null,
              }))}
              receipts={transaction.receipts.map((r: any) => ({ id: r.id, paymentId: r.paymentId }))}
              outstanding={outstanding}
              totals={{ totalPaid, totalPayable: transaction.totalPayable }}
            />

            <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
              <h2 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Statement preview (effective — matches the PDF)</h2>
              {preview.contractAssumed && (
                <p className="mono text-[11px] text-[#92400E] mt-2">Contract date assumed ({preview.contractDate}, earliest payment) — set the real sale date.</p>
              )}
              {preview.rows.length === 0 ? (
                <p className="mono text-[11px] text-[var(--ops-muted)] mt-3">No ledger entries yet.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead>
                      <tr className="bg-[var(--ops-bg)]/60 border-b border-[var(--ops-border)] text-left mono text-[10px] uppercase text-[var(--ops-muted)]">
                        <th className="px-3 py-2">Date</th><th className="px-3 py-2">Details</th><th className="px-3 py-2 text-right">Charges</th><th className="px-3 py-2 text-right">Payments</th><th className="px-3 py-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--ops-border)]/60">
                      {preview.rows.map((r, i) => (
                        <tr key={i} className="hover:bg-[var(--ops-bg)]/30">
                          <td className="px-3 py-2 mono text-[11px]">{r.date}</td>
                          <td className="px-3 py-2 text-[13px]">{r.line1}{r.line2 ? <div className="mono text-[10px] text-[var(--ops-muted)]">{r.line2}</div> : null}</td>
                          <td className="px-3 py-2 mono text-[11px] text-right price">{statementFmt.cell(r.charge)}</td>
                          <td className="px-3 py-2 mono text-[11px] text-right price">{statementFmt.cell(r.payment)}</td>
                          <td className="px-3 py-2 mono text-[11px] text-right price">{statementFmt.money(r.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mono text-[11px] text-[var(--ops-muted)] mt-2">
                Closing {statementFmt.money(preview.closing.balance)} · Total charges {statementFmt.cell(preview.totals.charges)} · Total paid {statementFmt.cell(preview.totals.payments)}
              </p>
              <p className="mono text-[10px] text-[var(--ops-muted)] mt-1">Client view: superseded entries excluded, no corrections note — exactly what the issued PDF shows. Generate a statement below for the PDF.</p>
            </div>

            <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
              <h2 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Internal ledger (full history)</h2>
              {transaction.ledgerEntries.length === 0 ? (
                <p className="mono text-[11px] text-[var(--ops-muted)] mt-3">No ledger entries yet.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead>
                      <tr className="bg-[var(--ops-bg)]/60 border-b border-[var(--ops-border)] text-left mono text-[10px] uppercase text-[var(--ops-muted)]">
                        <th className="px-3 py-2">Date</th><th className="px-3 py-2">Details</th><th className="px-3 py-2 text-right">Charges</th><th className="px-3 py-2 text-right">Payments</th><th className="px-3 py-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--ops-border)]/60">
                      {buildStatementRows(transaction.ledgerEntries.map((e) => ({
                        id: e.id,
                        type: e.type,
                        amount: e.amount,
                        direction: e.direction,
                        effectiveDate: e.effectiveDate,
                        createdAt: e.createdAt,
                        method: e.method,
                        bankReference: e.bankReference,
                      }))).rows.map((r, i) => (
                        <tr key={i} className="hover:bg-[var(--ops-bg)]/30">
                          <td className="px-3 py-2 mono text-[11px]">{r.date}</td>
                          <td className="px-3 py-2 text-[13px]">{r.details}{r.line2 ? <div className="mono text-[10px] text-[var(--ops-muted)]">{r.line2}</div> : null}</td>
                          <td className="px-3 py-2 mono text-[11px] text-right price">{r.debit != null ? formatNaira(r.debit) : "-"}</td>
                          <td className="px-3 py-2 mono text-[11px] text-right price">{r.credit != null ? formatNaira(r.credit) : "-"}</td>
                          <td className="px-3 py-2 mono text-[11px] text-right price">{formatNaira(r.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="mono text-[10px] text-[var(--ops-muted)] mt-2">Internal view: includes reversed entries. The client statement shows the effective ledger only.</p>
            </div>

            <StatementsPanel
              transactionId={transaction.id}
              transactionRef={transaction.ref}
              statements={transaction.statements.map((s: any) => ({
                id: s.id,
                number: s.number,
                asAt: formatDate(s.asAt),
                closingBalance: s.closingBalance,
                emailed: s.emailSentAt ? { at: formatDateTime(s.emailSentAt), to: s.emailRecipient ?? "-" } : null,
                defaultTo: transaction.customerEmail,
              }))}
            />

            <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Payment History</h2>
                {supersededPayments.length > 0 && (
                  <Link
                    href={showAll ? `/admin/transactions/${transaction.id}` : `/admin/transactions/${transaction.id}?history=all`}
                    className="mono text-[11px] text-[var(--ops-primary)] hover:underline underline-offset-4"
                  >
                    {showAll ? "Hide superseded entries" : `Show superseded entries (${supersededPayments.length})`}
                  </Link>
                )}
              </div>
              <p className="mono text-[11px] text-[var(--ops-muted)] mt-1">
                {effectivePayments.length} payments · {formatNaira(confirmedSum)} confirmed · {outstanding < 0 ? `Credit ${formatNaira(-outstanding)}` : formatNaira(outstanding)} outstanding
              </p>
              {listedPayments.length === 0 ? (
                <p className="mono text-[11px] text-[var(--ops-muted)] mt-3">No payments recorded yet.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {listedPayments.map((p: any) => {
                    const isSuperseded = p.status === "CANCELLED";
                    const replacement = allPayments.find((x: any) => x.correctsPaymentId === p.id);
                    const replacementReceipt = replacement ? transaction.receipts.find((r: any) => r.paymentId === replacement.id) : null;
                    const receipt = transaction.receipts.find((r: any) => r.paymentId === p.id);
                    const original = p.correctsPaymentId ? allPayments.find((x: any) => x.id === p.correctsPaymentId) : null;
                    const originalReceipt = original ? transaction.receipts.find((r: any) => r.paymentId === original.id) : null;
                    const audit = correctAuditByPayment.get(p.id) as { actorName: string; createdAt: Date; after: any } | undefined;
                    const after = (audit?.after ?? {}) as { amount?: number; reason?: string };
                    const unconfirmed = !(p.verificationNote ?? "").includes("Reconciled:");
                    return (
                      <div key={p.id} id={`payment-${p.id}`} className={`flex gap-3 p-3 rounded-xl border border-[var(--ops-border)] bg-[var(--ops-bg)]/30 scroll-mt-20 ${isSuperseded ? "opacity-60" : ""}`}>
                        <div className="h-8 w-8 rounded-full bg-[#0D3328] text-white grid place-items-center text-[11px] shrink-0">₦</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className={`text-[13px] font-medium price ${isSuperseded ? "line-through" : ""}`}>{formatNaira(p.amount)}</span>
                            <span className="mono text-[11px] text-[var(--ops-muted)]">{formatDate(p.paymentDate)}</span>
                          </div>
                          <div className="mono text-[11px] text-[var(--ops-muted)]">
                            Applied to: {appliedTo(p)}
                          </div>
                          <div className="mono text-[11px] text-[var(--ops-muted)]">{p.paymentMethod ?? "-"}{p.bankReference ? ` · bank: ${p.bankReference}` : ""}{p.notes ? <TruncatedNote text={p.notes} /> : ""}</div>
                          <div className="mono text-[10px] text-[var(--ops-muted)] font-mono">{p.paymentReference}</div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <StatusBadge status={p.status} className="px-2 py-0.5 text-[10px]" />
                            {p.correctsPaymentId && <span className="mono text-[10px] px-2 py-0.5 rounded-full bg-[#E0F2F1] text-[#0D3328] border border-[#B2DFDB]">Corrected</span>}
                            {isSuperseded && <span className="mono text-[10px] px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]">Superseded</span>}
                            {!isSuperseded && unconfirmed && <span className="mono text-[10px] px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]">Date unconfirmed</span>}
                            {(p.status === "CONFIRMED" || p.status === "PENDING_VERIFICATION") && (
                              <ReconcileButton
                                transactionId={transaction.id}
                                paymentId={p.id}
                                reconciled={!unconfirmed}
                              />
                            )}
                          </div>
                          {p.correctsPaymentId && original && (
                            <div className="mono text-[11px] text-[var(--ops-muted)] mt-1">
                              Originally recorded as {formatNaira(original.amount)}.
                              {audit ? ` Corrected ${formatDateDMY(audit.createdAt)} by ${audit.actorName}.` : ""}
                              {after.reason ? ` Reason: ${after.reason}` : ""}
                              {" "}<a href="#corrections" className="text-[var(--ops-primary)] hover:underline underline-offset-4">View correction</a>
                            </div>
                          )}
                          {p.verificationNote && <div className="mono text-[11px] text-[var(--ops-muted)] mt-1">Verified: {p.verificationNote}</div>}
                          {receipt && (
                            <div className="mono text-[11px] mt-1">
                              <Link href={`/admin/receipts/${receipt.id}`} className="text-[var(--ops-primary)] hover:underline">Receipt: {receipt.ref}</Link>
                              {receipt.voidedAt ? <span className="ml-2 text-red-700 font-medium">VOID</span> : ""}
                              {originalReceipt && (
                                <> <span className="text-[var(--ops-muted)]">replaces</span> <Link href={`/admin/receipts/${originalReceipt.id}`} className="text-[var(--ops-primary)] hover:underline">{originalReceipt.ref}</Link> <span className="text-red-700">(VOID)</span></>
                              )}
                            </div>
                          )}
                          {isSuperseded && replacement && (
                            <div className="mono text-[11px] mt-1">
                              <span className="text-[var(--ops-muted)]">Replaced by</span>{" "}
                              <a href={`#payment-${replacement.id}`} className="text-[var(--ops-primary)] hover:underline">{formatNaira(replacement.amount)} · {replacement.paymentReference}</a>
                              {replacementReceipt && <> · <Link href={`/admin/receipts/${replacementReceipt.id}`} className="text-[var(--ops-primary)] hover:underline">{replacementReceipt.ref}</Link></>}
                            </div>
                          )}
                          {p.status === "CONFIRMED" && (
                            <div className="flex flex-wrap items-center gap-2">
                              <PaymentVerificationButtons
                                transactionId={transaction.id}
                                paymentId={p.id}
                                allowConfirm={false}
                                payment={{ amount: p.amount, installmentLabel: appliedTo(p), isCredit: p.isCredit, creditAmount: p.creditAmount }}
                                totals={{ totalPaid, totalPayable: transaction.totalPayable }}
                              />
                              <CorrectPaymentDialog
                                transactionId={transaction.id}
                                paymentId={p.id}
                                paymentLabel={`${formatNaira(p.amount)} · ${p.paymentReference}`}
                              />
                            </div>
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
            <CorrectionsPanel
              transactionId={transaction.id}
              transactionRef={transaction.ref}
              customerEmail={transaction.customerEmail}
              contractDate={transaction.contractDate}
              payments={transaction.payments.map((p: any) => ({
                id: p.id,
                amount: p.amount,
                paymentDate: p.paymentDate,
                paymentReference: p.paymentReference,
                status: p.status,
                notes: p.notes,
                verificationNotes: p.verificationNotes,
                verificationNote: p.verificationNote,
                correctsPaymentId: p.correctsPaymentId,
              }))}
              receipts={transaction.receipts.map((r: any) => ({
                id: r.id,
                ref: r.ref,
                paymentId: r.paymentId,
                voidedAt: r.voidedAt,
                sentAt: r.sentAt,
                replacedBy: r.replacedBy ?? null,
              }))}
              latestStatementNumber={transaction.statements[0]?.number ?? null}
              draft={`Dear ${formatDisplayName(transaction.customerName).split(" ")[0]}, while reconciling your account we corrected how some of your payments were recorded. Your total payments of ${formatNaira(confirmedSum)} are unchanged. The attached receipts replace the earlier ones which showed different amounts, and the corrected statement shows your full position. Please disregard the earlier receipts. Your outstanding balance is ${outstanding < 0 ? `a credit of ${formatNaira(-outstanding)}` : formatNaira(outstanding)}. Contact us on +234 8103760063 if anything looks different from your records.`}
            />
            <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
              {transaction.receipts.length === 0 ? (
                <p className="mono text-[11px] text-[var(--ops-muted)] mt-3">No receipts yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {transaction.receipts.map((r: any) => (
                    <Link key={r.id} href={`/admin/receipts/${r.id}`} className="block p-3 rounded-xl border border-[var(--ops-border)] hover:bg-[var(--ops-bg)]">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-mono text-[12px] font-medium text-[var(--ops-primary)]">{r.ref}{r.voidedAt ? <span className="ml-2 text-red-700">VOID</span> : ""}</div>
                        {(r.pdfStatus === "FAILED" || !r.sentAt) && (
                          <span className="mono text-[10px] px-2 py-0.5 rounded-full bg-[#A6402F] text-white">Needs retry →</span>
                        )}
                      </div>
                      <div className="mono text-[11px] text-[var(--ops-muted)]">{formatDate(r.issuedAt)} · {r.sentAt ? "Emailed" : "Not emailed"} · {formatNaira(r.finalAmount)}</div>
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
