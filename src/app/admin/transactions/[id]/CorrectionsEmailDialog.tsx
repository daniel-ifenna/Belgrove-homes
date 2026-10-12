"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Correction email: system-drafted, sent ONLY on Send. Shows the draft,
// recipient, attachments and (optionally) an extra note. Fresh key per open;
// timeout retries reuse the handed-back key. Send disabled while in flight.
export default function CorrectionsEmailDialog({
  transactionId,
  transactionRef,
  defaultTo,
  replacements,
  statementNumber,
  draft,
}: {
  transactionId: string;
  transactionRef: string;
  defaultTo: string;
  replacements: string[];
  statementNumber: string | null;
  draft: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(defaultTo);
  const [note, setNote] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function openDialog() {
    setTo(defaultTo);
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
      const res = await fetch(`/api/admin/transactions/${transactionId}/corrections/email`, {
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
      setDone(`Emailed to ${data.to}: ${(data.receipts ?? []).join(", ")} + ${data.statement}.`);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  if (replacements.length === 0) return null;

  return (
    <>
      <button
        onClick={openDialog}
        className="mono text-[11px] bg-[var(--ops-primary)] text-white rounded-full px-4 py-2 font-medium hover:bg-[var(--ops-deep)]"
      >
        Email corrections to client
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Email corrections">
          <div className="absolute inset-0 bg-black/40" onClick={() => { if (!busy) setOpen(false); }} />
          <div className="relative w-full max-w-[520px] max-h-[90vh] overflow-y-auto bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-2xl p-6 shadow-xl">
            <div className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Email corrections</div>
            {error && <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">{error}</div>}
            {done && <div className="mt-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl px-3 py-2">{done}</div>}
            {!done && (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-[var(--ops-border)] bg-[var(--ops-bg)]/50 px-3 py-2.5 text-[13px] leading-relaxed">{draft}</div>
                <div>
                  <label className="mono text-[11px] text-[var(--ops-muted)]">Recipient *</label>
                  <input type="email" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm bg-white" />
                </div>
                <div className="mono text-[11px] text-[var(--ops-muted)]">Subject: Corrected receipts and statement, {transactionRef}</div>
                <div>
                  <label className="mono text-[11px] text-[var(--ops-muted)]">Extra note (optional)</label>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1 w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm bg-white" />
                </div>
                <div className="mono text-[11px] text-[var(--ops-muted)]">
                  Attachments: {replacements.join(", ")}{statementNumber ? `, ${statementNumber}` : ""}
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setOpen(false)} disabled={busy} className="mono text-[11px] text-[var(--ops-muted)] underline underline-offset-4 disabled:opacity-50">Cancel</button>
                  <button onClick={send} disabled={busy} className="mono text-[11px] bg-[var(--ops-primary)] text-white rounded-full px-4 py-2 font-medium disabled:opacity-50">
                    {busy ? "Sending…" : "Send"}
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
