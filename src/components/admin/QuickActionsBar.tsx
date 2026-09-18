"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Booking = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  location: string;
  preferredDate: string;
  preferredTime: string;
  updatedAt: string;
  status: string;
  lockedAt: string | null;
};

export default function QuickActionsBar({ booking }: { booking: Booking }) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [editForm, setEditForm] = useState({
    name: booking.name,
    email: booking.email,
    phone: booking.phone ?? "",
    location: booking.location,
    preferredDate: new Date(booking.preferredDate).toISOString().split("T")[0],
    preferredTime: booking.preferredTime,
  });
  const [rescheduleForm, setRescheduleForm] = useState({ date: "", time: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isLocked = booking.status === "closed" || !!booking.lockedAt;

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (isLocked) return;
    setBusy("edit");
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit_booking",
          expectedUpdatedAt: booking.updatedAt,
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone || null,
          location: editForm.location,
          preferredDate: editForm.preferredDate,
          preferredTime: editForm.preferredTime,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Edit failed");
      setShowEdit(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Edit failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleReschedule(e: React.FormEvent) {
    e.preventDefault();
    if (isLocked) return;
    if (!rescheduleForm.date || !rescheduleForm.time) {
      setError("Date and time are required");
      return;
    }
    setBusy("reschedule");
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reschedule",
          expectedUpdatedAt: booking.updatedAt,
          rescheduledDate: rescheduleForm.date,
          rescheduledTime: rescheduleForm.time,
          notifyClient: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reschedule failed");
      setShowReschedule(false);
      setRescheduleForm({ date: "", time: "" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reschedule failed");
    } finally {
      setBusy(null);
    }
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap gap-2 pt-5 border-t border-[var(--ops-border)]">
        <span className="mono text-[10px] tracking-[0.12em] uppercase text-[var(--ops-muted)] self-center mr-1">Quick actions</span>
        <button
          onClick={() => !isLocked && setShowEdit(true)}
          disabled={isLocked}
          className="inline-flex items-center gap-1.5 text-xs font-medium bg-white border border-[var(--ops-border)] rounded-full px-3.5 py-2 hover:bg-[var(--ops-bg)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </button>
        <button
          onClick={() => {
            if (isLocked) return;
            const el = document.getElementById("reschedule-section");
            if (el) el.scrollIntoView({ behavior: "smooth" });
            else setShowReschedule(true);
          }}
          disabled={isLocked}
          className="inline-flex items-center gap-1.5 text-xs font-medium bg-white border border-[var(--ops-border)] rounded-full px-3.5 py-2 hover:bg-[var(--ops-bg)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Reschedule
        </button>
        <a href="#assign-agent" onClick={(e) => { e.preventDefault(); scrollTo("assign-agent"); }} className="inline-flex items-center gap-1.5 text-xs font-medium bg-[var(--ops-primary)] text-white rounded-full px-4 py-2 hover:bg-[var(--ops-deep)] transition-colors">
          Assign Agent
        </a>
        <button
          onClick={() => scrollTo("internal-notes")}
          className="inline-flex items-center gap-1.5 text-xs font-medium bg-white border border-[var(--ops-border)] rounded-full px-3.5 py-2 hover:bg-[var(--ops-bg)] transition-colors"
        >
          Add Note
        </button>
        <div className="relative group">
          <button className="inline-flex items-center gap-1 text-xs text-[var(--ops-muted)] hover:text-[var(--ops-text)] px-2 py-2">
            More ▾
          </button>
          <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-[var(--ops-border)] rounded-xl shadow-[var(--ops-shadow-md)] p-1 hidden group-hover:block group-focus-within:block z-10">
            <button onClick={() => scrollTo("lead-temp")} className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--ops-bg)] rounded-lg">Change Lead Temp</button>
            <button onClick={() => scrollTo("timeline")} className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--ops-bg)] rounded-lg">View Timeline</button>
            <a href="#assign-agent" className="block px-3 py-2 text-xs hover:bg-[var(--ops-bg)] rounded-lg">Agent History</a>
          </div>
        </div>
      </div>

      {error && <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowEdit(false)} />
          <form onSubmit={handleEdit} className="relative bg-white rounded-[16px] border border-[var(--ops-border)] shadow-[var(--ops-shadow-lg)] w-full max-w-[520px] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-[18px] font-medium text-[var(--ops-text)]">Edit Booking</h3>
              <button type="button" onClick={() => setShowEdit(false)} className="h-7 w-7 rounded-full bg-[var(--ops-bg)] grid place-items-center text-[var(--ops-muted)] hover:text-[var(--ops-text)]">✕</button>
            </div>
            <div className="grid gap-4">
              <div>
                <label className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">Customer Name</label>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full mt-1 border border-[var(--ops-border)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ops-primary)]/10" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">Email</label>
                  <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="w-full mt-1 border border-[var(--ops-border)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ops-primary)]/10" required />
                </div>
                <div>
                  <label className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">Phone</label>
                  <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="w-full mt-1 border border-[var(--ops-border)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ops-primary)]/10" />
                </div>
              </div>
              <div>
                <label className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">Property / Location</label>
                <input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} className="w-full mt-1 border border-[var(--ops-border)] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ops-primary)]/10" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">Inspection Date</label>
                  <input type="date" value={editForm.preferredDate} onChange={(e) => setEditForm({ ...editForm, preferredDate: e.target.value })} className="w-full mt-1 border border-[var(--ops-border)] rounded-xl px-3 py-2.5 text-sm" required />
                </div>
                <div>
                  <label className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">Time</label>
                  <input value={editForm.preferredTime} onChange={(e) => setEditForm({ ...editForm, preferredTime: e.target.value })} placeholder="2:00 PM" className="w-full mt-1 border border-[var(--ops-border)] rounded-xl px-3 py-2.5 text-sm" required />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => setShowEdit(false)} className="text-sm bg-white border border-[var(--ops-border)] rounded-full px-5 py-2.5 hover:bg-[var(--ops-bg)]">Cancel</button>
              <button type="submit" disabled={busy === "edit"} className="text-sm bg-[var(--ops-primary)] text-white rounded-full px-6 py-2.5 font-medium hover:bg-[var(--ops-deep)] disabled:opacity-50">
                {busy === "edit" ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reschedule Modal */}
      {showReschedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowReschedule(false)} />
          <form onSubmit={handleReschedule} className="relative bg-white rounded-[16px] border border-[var(--ops-border)] shadow-[var(--ops-shadow-lg)] w-full max-w-[440px] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-[18px] font-medium text-[var(--ops-text)]">Reschedule Inspection</h3>
              <button type="button" onClick={() => setShowReschedule(false)} className="h-7 w-7 rounded-full bg-[var(--ops-bg)] grid place-items-center text-[var(--ops-muted)] hover:text-[var(--ops-text)]">✕</button>
            </div>
            <p className="text-xs text-[var(--ops-muted)] mb-4">Original: {new Date(booking.preferredDate).toLocaleDateString()} at {booking.preferredTime}. This will preserve history and notify the client.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">New Date</label>
                <input type="date" value={rescheduleForm.date} onChange={(e) => setRescheduleForm({ ...rescheduleForm, date: e.target.value })} min={new Date().toISOString().split("T")[0]} className="w-full mt-1 border border-[var(--ops-border)] rounded-xl px-3 py-2.5 text-sm" required />
              </div>
              <div>
                <label className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">New Time</label>
                <input value={rescheduleForm.time} onChange={(e) => setRescheduleForm({ ...rescheduleForm, time: e.target.value })} placeholder="2:00 PM" className="w-full mt-1 border border-[var(--ops-border)] rounded-xl px-3 py-2.5 text-sm" required />
              </div>
            </div>
            {error && <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => setShowReschedule(false)} className="text-sm bg-white border border-[var(--ops-border)] rounded-full px-5 py-2.5 hover:bg-[var(--ops-bg)]">Cancel</button>
              <button type="submit" disabled={busy === "reschedule"} className="text-sm bg-[#5B21B6] text-white rounded-full px-6 py-2.5 font-medium hover:bg-[#4C1D95] disabled:opacity-50">
                {busy === "reschedule" ? "Rescheduling…" : "Confirm Reschedule"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
