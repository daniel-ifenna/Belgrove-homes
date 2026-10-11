"use client";
import { useState } from "react";

export default function StatementActions({ transactionId, transactionRef }: { transactionId: string; transactionRef: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState<string | null>(null);

  async function sendEmail() {
    const key = retryKey;
    if (!key && !confirm(`Email the statement of account for ${transactionRef} to the client?`)) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/transactions/${transactionId}/statement/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(key ? { idempotencyKey: key } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 503 && data.idempotencyKey) {
        setRetryKey(data.idempotencyKey);
        setErr(`${data.error ?? "Send timed out."} Click again to retry with the same key — it will not duplicate.`);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Email failed");
      setRetryKey(null);
      setMsg(`Emailed to ${data.to ?? "client"}.`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Email failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {msg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl px-3 py-2">{msg}</div>}
      {err && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">{err}</div>}
      <div className="flex flex-wrap gap-2">
        <a href={`/api/admin/transactions/${transactionId}/statement`} className="mono text-[11px] bg-[var(--ops-primary)] text-white rounded-full px-4 py-2 font-medium hover:bg-[var(--ops-deep)]">Download PDF</a>
        <button onClick={sendEmail} disabled={busy} className="mono text-[11px] bg-white border border-[var(--ops-border)] rounded-full px-4 py-2 hover:bg-[var(--ops-bg)] disabled:opacity-50">
          {busy ? "Sending…" : retryKey ? "Retry email (same key)" : "Email to client"}
        </button>
      </div>
    </div>
  );
}
