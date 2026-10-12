"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/currency";

// Explicit statement email: opens a confirmation dialog (recipient, subject,
// note, attachment) and sends ONLY on Send. Fresh idempotency key per dialog
// open; timeout retries reuse the handed-back key. Send is disabled while a
// request is in flight so a double click cannot send twice.
export default function StatementEmailDialog({
  transactionId,
  transactionRef,
  statement,
}: {
  transactionId: string;
  transactionRef: string;
  statement: {
    id: string;
    number: string;
    closingBalance: number;
    defaultTo: string;
    emailed: { at: string; to: string } | null;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(statement.defaultTo);
  const [note, setNote] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function openDialog() {
    setTo(statement.defaultTo);
    setNote("");
    setKey(crypto.randomUUID());
    setError(null);
    setDone(null);
    setOpen(true);
  }

  async function send() {
    if (!to.trim()) {
      setError("Recipient email is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/transactions/${transactionId}/statements/${statement.id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim(), note: note.trim() || undefined, idempotencyKey: key, confirm: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 503 && data.idempotencyKey) {
        setKey(data.idempotencyKey);
        setError(`${data.error ?? "Send timed out."} Click Send again to retry with the same key — it will not duplicate.`);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setDone(`Emailed to ${data.to}.`);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={openDialog}
        className="mono text-[11px] bg-white border border-[var(--ops-border)] rounded-full px-3 py-1.5 hover:bg-[var(--ops-bg)]"
      >
        Email to client
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Email ${statement.number}`}>
          <div className="absolute inset-0 bg-black/40" onClick={() => { if (!busy) setOpen(false); }} />
          <div className="relative w-full max-w-[480px] max-h-[90vh] overflow-y-auto bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-2xl p-6 shadow-xl">
            <div className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Email statement</div>
            <div className="text-[15px] font-medium text-[var(--ops-text)] mt-1">{statement.number} · {formatNaira(statement.closingBalance)} outstanding</div>
            {statement.emailed && (
              <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                This statement was already emailed on {statement.emailed.at} to {statement.emailed.to}.
              </div>
            )}
            {error && <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">{error}</div>}
            {done && <div className="mt-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl px-3 py-2">{done}</div>}
            {!done && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mono text-[11px] text-[var(--ops-muted)]">Recipient *</label>
                  <input type="email" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm bg-white" />
                </div>
                <div className="mono text-[11px] text-[var(--ops-muted)]">Subject: Your statement of account, {transactionRef}</div>
                <div>
                  <label className="mono text-[11px] text-[var(--ops-muted)]">Note (optional)</label>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Anything to add to the email body" className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm bg-white" />
                </div>
                <div className="mono text-[11px] text-[var(--ops-muted)]">Attachment: Belgrove-{statement.number}.pdf</div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setOpen(false)} disabled={busy} className="mono text-[11px] text-[var(--ops-muted)] underline underline-offset-4 disabled:opacity-50">Cancel</button>
                  <button onClick={send} disabled={busy} className="mono text-[11px] bg-[var(--ops-primary)] text-white rounded-full px-4 py-2 font-medium disabled:opacity-50">
                    {busy ? "Sending…" : statement.emailed ? "Send again" : "Send"}
                  </button>
                </div>
              </div>
            )}
            {done && (
              <div className="mt-3 flex justify-end">
                <button onClick={() => setOpen(false)} className="mono text-[11px] bg-[var(--ops-primary)] text-white rounded-full px-4 py-2 font-medium">Done</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
