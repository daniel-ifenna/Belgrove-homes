"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReceiptActions({
  receipt,
  pdfHref,
}: {
  receipt: { id: string; ref: string; receiptUrl: string };
  pdfHref: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  // Key handed back with a 503 timeout: retrying with it replays the same
  // send instead of duplicating (the first request may have delivered).
  const [retryKey, setRetryKey] = useState<string | null>(null);

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

  async function resend(regen = false) {
    const key = retryKey;
    if (!key && !confirm(regen
      ? `Rebuild receipt ${receipt.ref} with current branding and resend it? The download updates once rebuilt.`
      : `Resend receipt ${receipt.ref} to its recipient? Each click sends a new email through Resend.`)) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/receipts/${receipt.id}/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(regen ? { regen: true } : {}), ...(key ? { idempotencyKey: key } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 503 && data.idempotencyKey) {
        // Unknown outcome (timeout): keep the key and ask before replaying.
        setRetryKey(data.idempotencyKey);
        setErr(`${data.error ?? "Send timed out."} Click Resend again to retry with the same key — it will not duplicate.`);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Resend failed");
      setRetryKey(null);
      setMsg(`Emailed ${data.receipt?.recipientEmail ?? "recipient"}${data.regenerated ? " with a rebuilt PDF" : ""}. Proof: ${data.resendEmailId ?? "see Resend dashboard"}.`);
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Resend failed");
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
        <button onClick={() => resend(false)} disabled={busy} className="text-xs bg-white border border-[var(--ops-border)] rounded-full px-4 py-2 hover:bg-[var(--ops-bg)] disabled:opacity-50">
          {busy ? "Sending…" : retryKey ? "Retry send (same key)" : "Resend email"}
        </button>
        <button onClick={() => resend(true)} disabled={busy} className="text-xs bg-white border border-[var(--ops-border)] rounded-full px-4 py-2 hover:bg-[var(--ops-bg)] disabled:opacity-50" title="Rebuild the PDF with current branding, then resend">
          {busy ? "Working…" : "Regenerate & resend"}
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
      <p className="mono text-[10px] text-[var(--ops-muted)]">Resend emails the same receipt <span className="font-mono font-medium text-[var(--ops-text)]">{receipt.ref}</span> through Resend. Delivery history lives in the Resend dashboard. No new receipt number is created.</p>
    </div>
  );
}
