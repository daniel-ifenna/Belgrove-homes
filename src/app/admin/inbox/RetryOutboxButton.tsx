"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Per-row "Retry now" for EMAIL_STUCK items. POSTs the outbox row id to the
// admin-session-authenticated retry route, then refreshes the inbox so the
// item clears (sent) or shows the fresh error (still stuck).
export default function RetryOutboxButton({ outboxId }: { outboxId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [detail, setDetail] = useState<string | null>(null);

  async function retry() {
    if (state === "sending") return;
    setState("sending");
    setDetail(null);
    try {
      const res = await fetch("/api/admin/outbox/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: outboxId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setState("error");
        setDetail(typeof data?.error === "string" ? data.error : "Retry failed");
        return;
      }
      if (data?.status === "SENT") {
        router.refresh();
        return;
      }
      setState("error");
      setDetail(typeof data?.lastError === "string" && data.lastError ? data.lastError : `Still ${String(data?.status ?? "pending").toLowerCase()}`);
    } catch {
      setState("error");
      setDetail("Network error");
    }
  }

  return (
    <span className="shrink-0 inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={retry}
        disabled={state === "sending"}
        className="mono text-[11px] bg-white border border-[var(--ops-border-strong)] text-[var(--ops-text)] rounded-full px-4 py-2 font-medium hover:border-[var(--ops-primary)] transition-colors disabled:opacity-50"
      >
        {state === "sending" ? "Retrying…" : "Retry now"}
      </button>
      {detail ? <span className="text-[11px] text-[var(--ops-muted)] max-w-[220px] text-right break-words">{detail}</span> : null}
    </span>
  );
}
