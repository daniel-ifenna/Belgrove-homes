"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReceiptActions({
  receipt,
  pdfHref,
}: {
  receipt: { id: string; ref: string; receiptUrl: string; status: string };
  pdfHref: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMsg(`${label} copied`);
      setTimeout(() => setMsg(null), 2000);
    } catch {
      setErr("Copy failed");
      setTimeout(() => setErr(null), 2000);
    } finally {
      setMenu(false);
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
      setMsg(`Resent to ${data.receipt?.recipientEmail ?? "recipient"} (${data.receipt?.status})`);
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
      <div className="flex flex-wrap items-center gap-2">
        <a href={receipt.receiptUrl} target="_blank" className="text-xs bg-white border border-[var(--ops-border)] rounded-full px-4 py-2 hover:bg-[var(--ops-bg)]">View</a>
        <a href={pdfHref} target="_blank" className="text-xs bg-[var(--ops-primary)] text-white rounded-full px-4 py-2 hover:bg-[var(--ops-deep)]">Download PDF</a>
        <button onClick={resend} disabled={busy} className="text-xs bg-white border border-[var(--ops-border)] rounded-full px-4 py-2 hover:bg-[var(--ops-bg)] disabled:opacity-50">
          {busy ? "Resending…" : "Resend"}
        </button>
        <div className="relative">
          <button
            onClick={() => setMenu((o) => !o)}
            onBlur={(e) => {
              if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) setMenu(false);
            }}
            aria-label="More actions"
            className="text-xs bg-white border border-[var(--ops-border)] rounded-full px-3 py-2 hover:bg-[var(--ops-bg)]"
          >
            ⋯
          </button>
          {menu && (
            <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-[var(--ops-border)] rounded-xl shadow-[var(--ops-shadow-md)] p-1.5 z-30">
              <button onClick={() => copy(receipt.ref, "Reference")} className="block w-full text-left px-3 py-2 rounded-lg text-[13px] hover:bg-[var(--ops-bg)]">Copy ref</button>
              <button onClick={() => copy(receipt.receiptUrl, "Link")} className="block w-full text-left px-3 py-2 rounded-lg text-[13px] hover:bg-[var(--ops-bg)]">Copy link</button>
            </div>
          )}
        </div>
      </div>
      <p className="mono text-[10px] text-[var(--ops-muted)]">Resend reuses the same receipt <span className="font-mono font-medium text-[var(--ops-text)]">{receipt.ref}</span> and records a new send attempt. No new receipt number is created.</p>
    </div>
  );
}
