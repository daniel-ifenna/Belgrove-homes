"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ContractDateForm({
  transactionId,
  current,
}: {
  transactionId: string;
  current: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(current ? current.slice(0, 10) : "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) {
      setError("A contract date is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/transactions/${transactionId}/contract-date`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractDate: date, reason: reason.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      {!open ? (
        <button onClick={() => { setOpen(true); setError(null); }} className="mono text-[11px] text-[var(--ops-primary)] hover:underline underline-offset-4">
          {current ? "Change" : "Set contract date"}
        </button>
      ) : (
        <form onSubmit={submit} className="mt-1 flex flex-wrap items-center gap-1.5">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border border-[var(--ops-border)] rounded-full px-3 py-1.5 text-[12px] bg-white" />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="flex-1 min-w-[140px] border border-[var(--ops-border)] rounded-full px-3 py-1.5 text-[12px] bg-white" />
          <button type="submit" disabled={busy} className="mono text-[11px] bg-[var(--ops-primary)] text-white rounded-full px-3 py-1.5 font-medium disabled:opacity-50">{busy ? "…" : "Save"}</button>
          <button type="button" onClick={() => setOpen(false)} className="mono text-[11px] text-[var(--ops-muted)] underline underline-offset-4">Cancel</button>
          {error && <div className="w-full text-[11px] text-red-700">{error}</div>}
        </form>
      )}
    </div>
  );
}
