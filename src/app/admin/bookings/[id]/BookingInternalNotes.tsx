"use client";
/* eslint-disable react-hooks/set-state-in-effect -- intentional prop->state sync after router.refresh */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatLagos } from "@/lib/time";

type Note = { id: string; authorName: string; body: string; createdAt: string | Date };

// Staff-only append-only notes. Extracted from BookingActions so the booking
// page can show it on its own Messages tab; the submit path (PATCH add_note
// with conflict/lock handling) is unchanged.
export default function BookingInternalNotes({
  bookingId,
  initialNotes = [],
  isLocked = false,
}: {
  bookingId: string;
  initialNotes?: Note[];
  isLocked?: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  async function submit() {
    if (!body.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_note", body }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setError(data.error ?? "This booking changed elsewhere. Refresh to see the latest.");
        return;
      }
      if (res.status === 423) {
        setError(data.error ?? "Locked — reopen required.");
        return;
      }
      if (res.status === 403) {
        setError(data.error ?? "Not allowed.");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      setBody("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-h"><h3>Internal notes</h3><span className="mono text-[11px] text-[var(--ops-muted)]">Staff only</span></div>
      <div className="pad">
        {notes.length > 0 ? (
          <div className="space-y-2">
            {notes.map((n) => (
              <div key={n.id} className="p-2.5 rounded-xl bg-[var(--ops-bg)] border border-[var(--ops-border)] text-sm">
                <div className="text-xs text-[var(--ops-muted)]">{n.authorName} · {formatLagos(n.createdAt, "datetime")}</div>
                <div className="text-[var(--ops-text)] whitespace-pre-wrap">{n.body}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">No internal notes yet.</div>
        )}
        {isLocked ? (
          <p className="mono text-[11px] text-[var(--ops-muted)] mt-4">Notes are locked for audit. Reopen to add more.</p>
        ) : (
          <div className="flex gap-2 mt-4">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add an internal note…"
              className="flex-1 border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm bg-white"
            />
            <button onClick={submit} disabled={!body.trim() || busy} className="btn sm">
              {busy ? "Adding…" : "Add"}
            </button>
          </div>
        )}
        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">{error}</p>}
      </div>
    </div>
  );
}
