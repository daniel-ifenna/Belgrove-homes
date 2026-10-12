import { getEntityHistory, getTransactionHistory } from "@/lib/activity";
import { formatLagos } from "@/lib/time";

// Read-only per-entity audit trail for transaction and receipt detail pages.
// (Bookings show their history in the existing UnifiedTimeline.)
// Transaction pages show the full scope: transaction events plus every
// payment/receipt/statement event on the account (corrections, voids,
// reissues, statements) with readable sentences.
export default async function ActivitySection({ entityType, entityId }: { entityType: string; entityId: string }) {
  const rows =
    entityType === "transaction" ? await getTransactionHistory(entityId) : await getEntityHistory(entityType, entityId);
  return (
    <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
      <div className="flex items-center justify-between">
        <h3 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">Activity</h3>
      </div>
      {rows.length === 0 ? (
        <p className="mono text-[11px] text-[var(--ops-muted)] mt-3">No recorded changes yet.</p>
      ) : (
        <ol className="mt-3 space-y-2.5">
          {rows.map((r) => (
            <li key={r.id} className="flex gap-3 text-[13px]">
              <span className="mono text-[11px] text-[var(--ops-muted)] whitespace-nowrap pt-0.5">{formatLagos(r.at, "datetime")}</span>
              <div className="min-w-0">
                <span className="font-medium text-[var(--ops-text)]">{r.action}</span>
                <span className="text-[var(--ops-muted)]"> · {r.actor}</span>
                {r.detail && <div className="mono text-[11px] text-[var(--ops-muted)] break-words">{r.detail}</div>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
