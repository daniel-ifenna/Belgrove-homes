"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/currency";
import StatementEmailDialog from "./StatementEmailDialog";

export type StatementRow = {
  id: string;
  number: string;
  asAt: string;
  closingBalance: number;
  emailed: { at: string; to: string } | null;
  defaultTo: string;
};

// Statements panel: Preview (DRAFT, never stored/emailed), Generate
// (stored, idempotent per ledger), and per-statement View/Download/Email.
// Generating and downloading NEVER email — only the Email dialog sends.
export default function StatementsPanel({
  transactionId,
  transactionRef,
  statements,
}: {
  transactionId: string;
  transactionRef: string;
  statements: StatementRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const [problems, setProblems] = useState<string[] | null>(null);
  const [ack, setAck] = useState(false);

  async function generate(acknowledgeWarnings = false) {
    setBusy(true);
    setMsg(null);
    setErr(null);
    let gated = false;
    try {
      const res = await fetch(`/api/admin/transactions/${transactionId}/statements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(acknowledgeWarnings ? { acknowledgeWarnings: true } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.problems) {
          // Invariant failure: generation blocked, nothing issued.
          gated = true;
          setProblems(data.problems);
          setWarnings(null);
          throw new Error(data.error ?? "Statement data check failed — generation blocked.");
        }
        if (data.requiresAck) {
          // Warnings: admin must tick "Issue anyway" (choice audit-logged).
          gated = true;
          setWarnings(data.warnings ?? []);
          setProblems(null);
          setAck(false);
          throw new Error(data.error ?? "This statement has warnings.");
        }
        throw new Error(data.error ?? "Generate failed");
      }
      setWarnings(null);
      setProblems(null);
      setMsg(data.created ? `Issued ${data.statement.number}.` : `Ledger unchanged — returned existing ${data.statement.number}.`);
      router.refresh();
    } catch (e: unknown) {
      if (!gated) setErr(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
      <h2 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Statements</h2>
      {msg && <div className="mt-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl px-3 py-2">{msg}</div>}
      {err && <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">{err}</div>}
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={`/api/admin/transactions/${transactionId}/statement/preview`} target="_blank" className="mono text-[11px] bg-white border border-[var(--ops-border)] rounded-full px-4 py-2 hover:bg-[var(--ops-bg)]">Preview (DRAFT)</a>
        <button onClick={() => generate(false)} disabled={busy} className="mono text-[11px] bg-[var(--ops-primary)] text-white rounded-full px-4 py-2 font-medium hover:bg-[var(--ops-deep)] disabled:opacity-50">
          {busy ? "Working…" : "Generate statement"}
        </button>
      </div>
      {problems && (
        <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">
          <div className="font-medium">Statement data check failed — generation blocked. Nothing was issued.</div>
          <ul className="list-disc ml-4 mt-1">{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
      )}
      {warnings && (
        <div className="mt-3 bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-xs rounded-xl px-3 py-2">
          <div className="font-medium">Warnings — review before issuing:</div>
          <ul className="list-disc ml-4 mt-1">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          <label className="mt-2 flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="rounded" />
            <span>Issue anyway (logged with your name)</span>
          </label>
          <button onClick={() => generate(true)} disabled={busy || !ack} className="mt-2 mono text-[11px] bg-[#92400E] text-white rounded-full px-4 py-2 font-medium disabled:opacity-50">
            {busy ? "Issuing…" : "Issue anyway"}
          </button>
        </div>
      )}
      {statements.length === 0 ? (
        <p className="mono text-[11px] text-[var(--ops-muted)] mt-3">No statements issued yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {statements.map((s) => (
            <div key={s.id} className="p-3 rounded-xl border border-[var(--ops-border)] bg-[var(--ops-bg)]/30">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-[12px] font-medium text-[var(--ops-primary)]">{s.number}</span>
                  <span className="mono text-[11px] text-[var(--ops-muted)]"> · as at {s.asAt} · closing {formatNaira(s.closingBalance)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <a href={`/api/admin/transactions/${transactionId}/statements/${s.id}`} target="_blank" className="mono text-[11px] bg-white border border-[var(--ops-border)] rounded-full px-3 py-1.5 hover:bg-[var(--ops-bg)]">View</a>
                  <a href={`/api/admin/transactions/${transactionId}/statements/${s.id}?download=1`} className="mono text-[11px] bg-white border border-[var(--ops-border)] rounded-full px-3 py-1.5 hover:bg-[var(--ops-bg)]">Download</a>
                  <StatementEmailDialog
                    transactionId={transactionId}
                    transactionRef={transactionRef}
                    statement={{ id: s.id, number: s.number, closingBalance: s.closingBalance, defaultTo: s.defaultTo, emailed: s.emailed }}
                  />
                </div>
              </div>
              <div className="mono text-[11px] text-[var(--ops-muted)] mt-1">
                {s.emailed ? `Emailed ${s.emailed.at} to ${s.emailed.to}` : "Not emailed"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
