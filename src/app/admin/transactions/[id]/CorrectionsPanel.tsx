import Link from "next/link";
import { formatNaira } from "@/lib/currency";
import { formatDate } from "@/lib/booking-ui";
import ContractDateForm from "./ContractDateForm";
import CorrectionsEmailDialog from "./CorrectionsEmailDialog";

type PanelPayment = {
  id: string;
  amount: number;
  paymentDate: Date;
  paymentReference: string;
  status: string;
  notes: string | null;
  verificationNotes: string | null;
  verificationNote: string | null;
  correctsPaymentId: string | null;
};

type PanelReceipt = {
  id: string;
  ref: string;
  paymentId: string | null;
  voidedAt: Date | null;
  sentAt: Date | null;
  replacedBy: { id: string; ref: string } | null;
};

// Corrections: every reversal and replacement (what, why, who, when,
// verification note). Read-only trail — corrections happen via the Correct
// action on each confirmed payment, never by editing.
export default function CorrectionsPanel({
  transactionId,
  transactionRef,
  customerEmail,
  contractDate,
  payments,
  receipts,
  latestStatementNumber,
  draft,
}: {
  transactionId: string;
  transactionRef: string;
  customerEmail: string;
  contractDate: Date | null;
  payments: PanelPayment[];
  receipts: PanelReceipt[];
  latestStatementNumber: string | null;
  draft: string;
}) {
  const replacements = payments.filter((p) => p.correctsPaymentId);
  const voided = payments.filter((p) => p.status === "CANCELLED");
  const voidedReceipts = receipts.filter((r) => r.voidedAt);
  const empty = replacements.length === 0 && voided.length === 0 && voidedReceipts.length === 0;
  // Replacement receipts not yet emailed drive the correction email dialog.
  const replacementIds = new Set(replacements.map((p) => p.id));
  const unsentReplacements = receipts
    .filter((r) => r.paymentId && replacementIds.has(r.paymentId) && !r.sentAt)
    .map((r) => r.ref);

  return (
    <div id="corrections" className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)] scroll-mt-20">
      <h2 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Sale date & Corrections</h2>
      <div className="mt-3 text-sm">
        <span className="text-[var(--ops-muted)]">Contract date: </span>
        <span className="font-medium">{contractDate ? formatDate(contractDate) : "not set (charges date from creation)"}</span>
        <ContractDateForm transactionId={transactionId} current={contractDate ? new Date(contractDate).toISOString() : null} />
      </div>
      {empty ? (
        <p className="mono text-[11px] text-[var(--ops-muted)] mt-3">No corrections recorded.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {replacements.map((p) => (
            <div key={p.id} className="p-3 rounded-xl border border-[var(--ops-border)] bg-[var(--ops-bg)]/30">
              <div className="text-[13px] font-medium">Replacement {formatNaira(p.amount)} <span className="mono text-[11px] text-[var(--ops-muted)] font-normal">{p.paymentReference} · {formatDate(p.paymentDate)}</span></div>
              {p.notes && <div className="text-[12px] text-[var(--ops-text)] mt-1">{p.notes}</div>}
              {p.verificationNote && <div className="mono text-[11px] text-[var(--ops-muted)] mt-1">Verified: {p.verificationNote}</div>}
            </div>
          ))}
          {voided.map((p) => (
            <div key={p.id} className="p-3 rounded-xl border border-[var(--ops-border)] bg-white">
              <div className="text-[13px]">Reversed {formatNaira(p.amount)} <span className="mono text-[11px] text-[var(--ops-muted)]">{p.paymentReference} · {formatDate(p.paymentDate)}</span></div>
              {p.verificationNotes && <div className="mono text-[11px] text-[var(--ops-muted)] mt-1">{p.verificationNotes}</div>}
            </div>
          ))}
          {voidedReceipts.map((r) => (
            <div key={r.id} className="p-3 rounded-xl border border-red-200 bg-red-50/50 flex flex-wrap items-center justify-between gap-2">
              <span className="mono text-[12px] text-red-800">VOID {r.ref}</span>
              {r.replacedBy && <Link href={`/admin/receipts/${r.replacedBy.id}`} className="mono text-[11px] text-[var(--ops-primary)] hover:underline">→ {r.replacedBy.ref}</Link>}
            </div>
          ))}
        </div>
      )}
      {unsentReplacements.length > 0 && (
        <div className="mt-4">
          <CorrectionsEmailDialog
            transactionId={transactionId}
            transactionRef={transactionRef}
            defaultTo={customerEmail}
            replacements={unsentReplacements}
            statementNumber={latestStatementNumber}
            draft={draft}
          />
        </div>
      )}
    </div>
  );
}
