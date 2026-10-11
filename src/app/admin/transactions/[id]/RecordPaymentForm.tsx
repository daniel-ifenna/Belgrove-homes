"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/currency";
import { previewAllocation } from "@/lib/finance/ledger";

type Installment = { id: string; installmentNumber: number; type: string; dueDate: string; scheduledAmount: number; paidAmount: number; status: string };

const LAST_METHOD_KEY = "belgrove-last-payment-method";

const labelOf = (inst: Installment) => (inst.type === "INITIAL" ? "Initial payment" : `Month ${inst.installmentNumber}`);

// Free-amount record form: the schedule is a guide, never a gate. The admin
// types whatever the client actually paid; the suggested next amount is a
// hint only, and a live preview shows exactly what confirming will do.
export default function RecordPaymentForm({
  transactionId,
  installments,
  outstanding,
  totalPaid,
  totalPayable,
  onDone,
}: {
  transactionId: string;
  installments: Installment[];
  outstanding: number;
  totalPaid: number;
  totalPayable: number;
  onDone?: () => void;
}) {
  const router = useRouter();
  const ordered = useMemo(() => [...installments].sort((a, b) => a.installmentNumber - b.installmentNumber), [installments]);
  const suggested = ordered.find((i) => i.scheduledAmount - (i.paidAmount ?? 0) > 0);
  const suggestedDue = suggested ? Math.max(0, suggested.scheduledAmount - (suggested.paidAmount ?? 0)) : 0;

  // One UUID per form open: double-clicks and retries replay the same key and
  // can never mint a second payment. Rotated after each recorded payment.
  const [idemKey, setIdemKey] = useState(() => crypto.randomUUID());
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState(() => {
    try {
      return localStorage.getItem(LAST_METHOD_KEY) || "Bank Transfer";
    } catch {
      return "Bank Transfer";
    }
  });
  const [bankReference, setBankReference] = useState("");
  const [notes, setNotes] = useState("");
  const [asCredit, setAsCredit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const amountNum = parseInt(amount.replace(/[^0-9]/g, ""), 10) || 0;
  const overBy = amountNum - outstanding;
  const isOver = amountNum > 0 && overBy > 0;

  const preview = useMemo(() => {
    if (amountNum <= 0) return null;
    try {
      return previewAllocation(
        ordered.map((i) => ({ id: i.id, installmentNumber: i.installmentNumber, scheduledAmount: i.scheduledAmount, paidAmount: i.paidAmount ?? 0, label: labelOf(i) })),
        amountNum,
        totalPayable,
        totalPaid
      );
    } catch {
      return null;
    }
  }, [amountNum, ordered, totalPayable, totalPaid]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (amountNum <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (isOver && !asCredit) {
      setError(`Amount exceeds the outstanding balance by ${formatNaira(overBy)}. Tick "record excess as credit" to proceed.`);
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/transactions/${transactionId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountNum, paymentDate, paymentMethod, bankReference: bankReference.trim() || undefined, notes, idempotencyKey: idemKey, asCredit: isOver }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to record payment");
      try {
        localStorage.setItem(LAST_METHOD_KEY, paymentMethod);
      } catch {
        // ignore storage failures
      }
      setSuccess(
        data.deduped
          ? "This form was already submitted; showing the existing entry instead of a duplicate."
          : "Payment recorded as pending verification. Confirm it in Payment History below to issue the receipt and update totals."
      );
      setAmount("");
      setNotes("");
      setBankReference("");
      setAsCredit(false);
      setIdemKey(crypto.randomUUID());
      router.refresh();
      if (onDone) setTimeout(onDone, 1200);
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 border-t border-[var(--ops-border)] pt-6">
      <h3 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Record Payment</h3>
      <p className="mono text-[11px] text-[var(--ops-muted)] mt-1">Two steps: record here (pending), then confirm in Payment History. Confirming issues the receipt, emails the client, and updates totals atomically.</p>
      {suggested && (
        <p className="mono text-[11px] text-[var(--ops-muted)] mt-1">Suggested next: {formatNaira(suggestedDue)} ({labelOf(suggested)}) · Outstanding {formatNaira(outstanding)}</p>
      )}
      {error && <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">{error}</div>}
      {success && <div className="mt-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl px-3 py-2">{success}</div>}
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="mono text-[11px] text-[var(--ops-muted)]">Amount received (₦) *</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={suggestedDue ? String(suggestedDue) : "e.g. 2905000"} inputMode="numeric" className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mono text-[11px] text-[var(--ops-muted)]">Payment date *</label>
            <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm" />
          </div>
        </div>
        {preview && preview.lines.length > 0 && (
          <div className="rounded-xl border border-[var(--ops-border)] bg-[var(--ops-bg)]/50 px-3 py-2.5">
            <div className="mono text-[10px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Confirming will</div>
            <ul className="mt-1 space-y-0.5 text-[12px] text-[var(--ops-text)]">
              {preview.lines.map((l) => (
                <li key={l.installmentId}>
                  {l.clears ? "Clears" : "Part-pays"} {l.label} ({formatNaira(l.applied)}{l.clears ? "" : ` of ${formatNaira(l.scheduled)}`}).
                </li>
              ))}
            </ul>
            <div className="mono text-[11px] text-[var(--ops-muted)] mt-1">Balance after: {formatNaira(preview.balanceAfter)}</div>
          </div>
        )}
        {isOver && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5">
            <div className="text-[12px] text-amber-900">Exceeds outstanding by {formatNaira(overBy)}. The excess is only recorded as an explicit, visible credit balance.</div>
            <label className="mt-1.5 flex items-center gap-2 text-[12px] text-amber-900">
              <input type="checkbox" checked={asCredit} onChange={(e) => setAsCredit(e.target.checked)} className="rounded" />
              Record excess of {formatNaira(overBy)} as credit
            </label>
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="mono text-[11px] text-[var(--ops-muted)]">Payment method</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm bg-white"><option>Bank Transfer</option><option>Cash</option><option>Cheque</option><option>POS</option><option>Installment</option></select>
          </div>
          <div>
            <label className="mono text-[11px] text-[var(--ops-muted)]">Bank / teller reference <span className="normal-case">(optional)</span></label>
            <input value={bankReference} onChange={(e) => setBankReference(e.target.value)} placeholder="e.g. TRF-88231" className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mono text-[11px] text-[var(--ops-muted)]">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={busy || amountNum <= 0 || (isOver && !asCredit)} className="text-sm bg-[var(--ops-primary)] text-white rounded-full px-6 py-2.5 font-medium hover:bg-[var(--ops-deep)] disabled:opacity-50">{busy ? "Recording…" : "Record Payment for Verification"}</button>
        </div>
      </form>
    </div>
  );
}
