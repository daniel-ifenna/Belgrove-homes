"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon } from "@/components/admin/icons";

// Bank-reconciliation tick: confirm one payment against a bank statement
// line. Appends to the verification note (who, when) — never overwrites.
export default function ReconcileButton({
  transactionId,
  paymentId,
  reconciled,
}: {
  transactionId: string;
  paymentId: string;
  reconciled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bankLine, setBankLine] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!bankLine.trim()) {
      setError("Bank statement line reference is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/transactions/${transactionId}/payments/${paymentId}/reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankLine: bankLine.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Reconcile failed");
      setOpen(false);
      setBankLine("");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Reconcile failed");
    } finally {
      setBusy(false);
    }
  }

  if (reconciled) {
    return <span className="mono text-[10px] px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] inline-flex items-center gap-1">Reconciled <CheckIcon size={10} /></span>;
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setError(null); }}
        className="mono text-[10px] text-[var(--ops-muted)] underline underline-offset-4 hover:text-[var(--ops-text)]"
      >
        Tick vs bank
      </button>
      {open && (
        <form onSubmit={submit} className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <input
            value={bankLine}
            onChange={(e) => setBankLine(e.target.value)}
            placeholder="Bank line ref (e.g. 262220980712)"
            className="flex-1 min-w-[140px] border border-[var(--ops-border)] rounded-full px-3 py-1.5 text-[12px] bg-white"
          />
          <button type="submit" disabled={busy} className="mono text-[11px] bg-[var(--ops-primary)] text-white rounded-full px-3 py-1.5 font-medium disabled:opacity-50">
            {busy ? "…" : "Tick"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="mono text-[11px] text-[var(--ops-muted)] underline underline-offset-4">Cancel</button>
          {error && <div className="w-full text-[11px] text-red-700">{error}</div>}
        </form>
      )}
    </>
  );
}
