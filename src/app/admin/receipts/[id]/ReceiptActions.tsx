"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReceiptActions({ receipt }: { receipt: { id: string; ref: string; receiptUrl: string; status: string } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMsg(`${label} copied`);
      setTimeout(() => setMsg(null), 2000);
    } catch {
      setErr("Copy failed");
      setTimeout(() => setErr(null), 2000);
    }
  }

  async function resend() {
    if (!confirm(`Resend receipt ${receipt.ref} to its recipient? This will reuse the same reference and create a new send attempt.`)) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/receipts/${receipt.id}/resend`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Resend failed");
      setMsg(`Resent to ${data.receipt?.recipientEmail ?? "recipient"} — ${data.receipt?.status}`);
      router.refresh();
    } catch (e: any) {
      setErr(e.message ?? "Resend failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      {msg && <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl px-3 py-2">{msg}</div>}
      {err && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">{err}</div>}
      <div className="flex flex-wrap gap-2">
        <a href={receipt.receiptUrl} target="_blank" className="text-xs bg-white border border-[var(--ops-border)] rounded-full px-4 py-2 hover:bg-[var(--ops-bg)]">View Receipt</a>
        <a href={receipt.receiptUrl} target="_blank" className="text-xs bg-white border border-[var(--ops-border)] rounded-full px-4 py-2 hover:bg-[var(--ops-bg)]">View URL</a>
        <a href={`/api/receipts/${receipt.ref}/pdf`} target="_blank" className="text-xs bg-white border border-[var(--ops-border)] rounded-full px-4 py-2 hover:bg-[var(--ops-bg)]">Download PDF</a>
        <button onClick={() => copy(receipt.ref, "Reference")} className="text-xs bg-white border border-[var(--ops-border)] rounded-full px-4 py-2 hover:bg-[var(--ops-bg)]">Copy ref</button>
        <button onClick={() => copy(receipt.receiptUrl, "URL")} className="text-xs bg-white border border-[var(--ops-border)] rounded-full px-4 py-2 hover:bg-[var(--ops-bg)]">Copy URL</button>
        <button onClick={resend} disabled={busy} className="text-xs bg-[var(--ops-primary)] text-white rounded-full px-5 py-2 font-medium hover:bg-[var(--ops-deep)] disabled:opacity-50">
          {busy ? "Resending…" : "Resend receipt"}
        </button>
      </div>
      <p className="mono text-[10px] text-[var(--ops-muted)]">Resend reuses the same receipt <span className="font-mono font-medium text-[var(--ops-text)]">{receipt.ref}</span> and records a new send attempt — no new receipt number is created.</p>
    </div>
  );
}
