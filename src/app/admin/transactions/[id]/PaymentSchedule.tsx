"use client";
import { Fragment, useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/admin/StatusBadge";
import { formatNaira } from "@/lib/currency";
import { formatLagos } from "@/lib/time";
import RecordPaymentForm from "./RecordPaymentForm";
import PaymentVerificationButtons from "./PaymentVerificationButtons";

export type ScheduleInstallment = {
  id: string;
  installmentNumber: number;
  type: string;
  dueDate: string;
  scheduledAmount: number;
  confirmedPaid: number;
  pendingTotal: number;
  status: "Paid" | "Late" | "Partial" | "Pending";
  overdue: boolean;
};

export type SchedulePayment = {
  id: string;
  installmentId: string | null;
  amount: number;
  paymentDate: string;
  paymentMethod: string | null;
  paymentReference: string;
  bankReference: string | null;
  notes: string | null;
  status: string;
};

export type ScheduleReceipt = { id: string; paymentId: string | null };

// Payment schedule: per-row Record buttons open a prefilled drawer; pending
// payments sit directly under their installment with Confirm/Void.
export default function PaymentSchedule({
  transactionId,
  installments,
  payments,
  receipts,
  outstanding,
  totals,
}: {
  transactionId: string;
  installments: ScheduleInstallment[];
  payments: SchedulePayment[];
  receipts: ScheduleReceipt[];
  outstanding: number;
  totals: { totalPaid: number; totalPayable: number };
}) {
  const [drawerFor, setDrawerFor] = useState<ScheduleInstallment | null>(null);

  const labelOf = (inst: ScheduleInstallment) =>
    inst.type === "INITIAL" ? "Initial payment" : `Month ${inst.installmentNumber}`;

  return (
    <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
      <h2 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Payment Schedule</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-[var(--ops-bg)]/60 border-b border-[var(--ops-border)] text-left mono text-[10px] uppercase text-[var(--ops-muted)]">
              <th className="px-3 py-2">Payment</th><th className="px-3 py-2">Due Date</th><th className="px-3 py-2 text-right">Scheduled</th><th className="px-3 py-2 text-right">Paid</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Receipt</th><th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--ops-border)]/60">
            {installments.map((inst) => {
              const confirmed = payments.filter((p) => p.installmentId === inst.id && p.status === "CONFIRMED");
              const pendings = payments.filter((p) => p.installmentId === inst.id && p.status === "PENDING_VERIFICATION");
              const receiptLink = confirmed.length > 0 ? receipts.find((r) => confirmed.some((p) => p.id === r.paymentId)) : null;
              const due = Math.max(0, inst.scheduledAmount - inst.confirmedPaid);
              return (
                <Fragment key={inst.id}>
                  <tr className="hover:bg-[var(--ops-bg)]/30">
                    <td className="px-3 py-2"><span className="font-medium">{labelOf(inst)}</span><div className="mono text-[10px] text-[var(--ops-muted)]">#{inst.installmentNumber}</div></td>
                    <td className="px-3 py-2 mono text-[11px]">{formatLagos(inst.dueDate)}</td>
                    <td className="px-3 py-2 mono text-[11px] text-right price">{formatNaira(inst.scheduledAmount)}</td>
                    <td className="px-3 py-2 mono text-[11px] text-right price">{formatNaira(inst.confirmedPaid)}</td>
                    <td className="px-3 py-2"><StatusBadge status={inst.status} className="px-2 py-1 text-[10px]" /></td>
                    <td className="px-3 py-2 text-right">{receiptLink ? <Link href={`/admin/receipts/${receiptLink.id}`} className="text-xs text-[var(--ops-primary)] hover:underline">View</Link> : "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {inst.status !== "Paid" && (
                        <button
                          onClick={() => setDrawerFor(inst)}
                          className="mono text-[11px] bg-[var(--ops-primary)] text-white rounded-full px-3 py-1.5 font-medium hover:bg-[var(--ops-deep)] transition-colors whitespace-nowrap"
                        >
                          Record payment
                        </button>
                      )}
                    </td>
                  </tr>
                  {pendings.map((p) => (
                    <tr key={p.id} id={`payment-${p.id}`} className="bg-[#FFFBEB]/40 scroll-mt-20">
                      <td className="px-3 py-2 pl-6" colSpan={2}>
                        <span className="mono text-[11px] text-[#92400E]">Pending {formatNaira(p.amount)}</span>
                        <div className="mono text-[10px] text-[var(--ops-muted)]">{p.paymentReference}{p.bankReference ? ` · bank: ${p.bankReference}` : ""} · {p.paymentMethod ?? "—"}</div>
                      </td>
                      <td className="px-3 py-2" colSpan={5}>
                        <PaymentVerificationButtons
                          transactionId={transactionId}
                          paymentId={p.id}
                          payment={{ amount: p.amount, installmentLabel: labelOf(inst) }}
                          totals={totals}
                        />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {drawerFor && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Record payment for ${labelOf(drawerFor)}`}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerFor(null)} />
          <div className="relative w-full max-w-[440px] h-full overflow-y-auto bg-[var(--ops-surface)] border-l border-[var(--ops-border)] p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Record payment</div>
                <div className="text-[15px] font-medium text-[var(--ops-text)] mt-1">{labelOf(drawerFor)} · due {formatNaira(Math.max(0, drawerFor.scheduledAmount - drawerFor.confirmedPaid))}</div>
              </div>
              <button onClick={() => setDrawerFor(null)} aria-label="Close" className="h-8 w-8 rounded-full border border-[var(--ops-border)] grid place-items-center text-[var(--ops-muted)] hover:text-[var(--ops-text)]">✕</button>
            </div>
            <RecordPaymentForm
              transactionId={transactionId}
              installments={installments.map((i) => ({
                id: i.id,
                installmentNumber: i.installmentNumber,
                type: i.type,
                dueDate: i.dueDate,
                scheduledAmount: i.scheduledAmount,
                paidAmount: i.confirmedPaid,
                status: i.status,
              }))}
              outstanding={outstanding}
              initialInstallmentId={drawerFor.id}
              lockInstallment
              onDone={() => setDrawerFor(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
