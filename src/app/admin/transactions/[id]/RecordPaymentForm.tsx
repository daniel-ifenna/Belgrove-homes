"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/currency";

type Installment = { id: string; installmentNumber: number; type: string; dueDate: string; scheduledAmount: number; paidAmount: number; status: string };

const LAST_METHOD_KEY = "belgrove-last-payment-method";

export default function RecordPaymentForm({
  transactionId,
  installments,
  outstanding,
  initialInstallmentId,
  lockInstallment = false,
  onDone,
}: {
  transactionId: string;
  installments: Installment[];
  outstanding: number;
  initialInstallmentId?: string;
  lockInstallment?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const firstUnpaid = installments.find((i) => i.id === initialInstallmentId) ?? installments.find((i) => i.status !== "Paid") ?? installments[0];
  const dueOf = (inst: Installment | undefined) => (inst ? Math.max(0, inst.scheduledAmount - (inst.paidAmount ?? 0)) : 0);
  const [installmentId, setInstallmentId] = useState(firstUnpaid?.id ?? "");
  // Amount is pre-filled from the schedule — the admin confirms date/method,
  // and may reduce it for a partial payment, but never types it blind.
  const [amount, setAmount] = useState(() => String(dueOf(firstUnpaid) || ""));
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selected = installments.find((i) => i.id === installmentId);
  const due = dueOf(selected);
  const amountNum = parseInt(amount.replace(/[^0-9]/g, ""), 10) || 0;

  function onInstallmentChange(id: string) {
    setInstallmentId(id);
    const inst = installments.find((i) => i.id === id);
    if (inst) setAmount(String(dueOf(inst)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!installmentId) {
      setError("Select an installment");
      return;
    }
    if (amountNum <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (amountNum > outstanding) {
      setError(`Amount exceeds outstanding balance of ${formatNaira(outstanding)}`);
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/transactions/${transactionId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installmentId, amount: amountNum, paymentDate, paymentMethod, bankReference: bankReference.trim() || undefined, notes }),
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
          ? "Identical payment was just recorded — showing the existing entry instead of a duplicate."
          : "Payment recorded as pending verification — confirm it in Payment History below to issue the receipt and update totals."
      );
      setAmount("");
      setNotes("");
      setBankReference("");
      router.refresh();
      if (onDone) setTimeout(onDone, 1200);
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: any) {
      setError(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 border-t border-[var(--ops-border)] pt-6">
      <h3 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Record Payment</h3>
      <p className="mono text-[11px] text-[var(--ops-muted)] mt-1">Two steps: record here (pending), then confirm in Payment History — confirming issues the receipt, emails the client, and updates totals atomically.</p>
      {error && <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">{error}</div>}
      {success && <div className="mt-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl px-3 py-2">{success}</div>}
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label className="mono text-[11px] text-[var(--ops-muted)]">Installment *</label>
          <select
            value={installmentId}
            onChange={(e) => onInstallmentChange(e.target.value)}
            disabled={lockInstallment}
            className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm bg-white disabled:bg-[var(--ops-bg)] disabled:text-[var(--ops-muted)]"
          >
            {installments.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.type === "INITIAL" ? "Initial" : `Month ${inst.installmentNumber}`} — Due {new Date(inst.dueDate).toLocaleDateString("en-GB")} — Scheduled {formatNaira(inst.scheduledAmount)} — Paid {formatNaira(inst.paidAmount)} — {inst.status} {inst.scheduledAmount - inst.paidAmount > 0 ? `· Due ${formatNaira(inst.scheduledAmount - inst.paidAmount)}` : ""}
              </option>
            ))}
          </select>
          {selected && <div className="mono text-[11px] text-[var(--ops-muted)] mt-1">Selected due: {formatNaira(due)} · Outstanding transaction: {formatNaira(outstanding)}</div>}
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="mono text-[11px] text-[var(--ops-muted)]">Amount received (₦) *</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={due ? String(due) : "2905000"} inputMode="numeric" className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm" />
            {selected && amountNum > 0 && amountNum !== due && <div className="mono text-[10px] text-amber-700 mt-1">{amountNum < due ? `Partial — remaining ${formatNaira(due - amountNum)} for this installment` : amountNum > due ? `Over scheduled by ${formatNaira(amountNum - due)} — will still be applied` : ""}</div>}
          </div>
          <div>
            <label className="mono text-[11px] text-[var(--ops-muted)]">Payment date *</label>
            <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm" />
          </div>
        </div>
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
          <button type="submit" disabled={busy || amountNum <= 0 || amountNum > outstanding} className="text-sm bg-[var(--ops-primary)] text-white rounded-full px-6 py-2.5 font-medium hover:bg-[var(--ops-deep)] disabled:opacity-50">{busy ? "Recording…" : "Record Payment for Verification"}</button>
        </div>
      </form>
    </div>
  );
}
