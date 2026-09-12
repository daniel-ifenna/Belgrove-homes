"use client";
/* eslint-disable react-hooks/set-state-in-effect -- intentional prop->state sync after router.refresh */

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { isTransitionAllowed, temperatureRank } from "@/lib/booking-transitions";
import { timeSlots } from "@/lib/content";
import type { BookingStatus, LeadTemperature } from "@/generated/prisma/client";

type Booking = {
  id: string;
  status: BookingStatus;
  leadTemperature: LeadTemperature;
  agentName: string | null;
  agentId?: string | null;
  assignedToId: string | null;
  updatedAt: Date;
  lockedAt?: Date | string | null;
  agentConfirmedAt?: Date | string | null;
};

type StaffUser = { id: string; name: string; email: string; role?: string };
type CompanyAgent = { id: string; name: string; email: string; phone: string; category: "staff" | "hire_purchase" };
type BookingMessage = { id: string; authorName: string; message: string; createdAt: string | Date };
type InternalNote = { id: string; authorName: string; body: string; createdAt: string | Date };

const temperatureOrder: LeadTemperature[] = ["cold", "warm", "hot"];

export default function BookingActions({
  booking,
  // staffUsers kept for compat but unused in single-admin mode
  staffUsers: _staffUsers,
  agents,
  initialMessages = [],
  internalNotes = [],
  isLocked = false,
}: {
  booking: Booking;
  staffUsers: StaffUser[];
  agents: CompanyAgent[];
  initialMessages?: BookingMessage[];
  internalNotes?: InternalNote[];
  isLocked?: boolean;
  userRole?: string;
}) {
  const router = useRouter();
  void _staffUsers;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(booking.updatedAt.toISOString());
  const [lastEmail, setLastEmail] = useState<{ sent: boolean; error: string | null } | null>(null);

  // Shared review note
  const [reviewNote, setReviewNote] = useState("");
  const [rescheduledDate, setRescheduledDate] = useState("");
  const [rescheduledTime, setRescheduledTime] = useState("");
  const [notifyClient, setNotifyClient] = useState(true);
  const [activeNote, setActiveNote] = useState("");

  // Assign + typeahead search-only, no full dropdown
  const [agentQuery, setAgentQuery] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState(booking.agentId ?? "");
  const [assignNote, setAssignNote] = useState("");
  const [assignSilent, setAssignSilent] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Lead
  const [escalateNote, setEscalateNote] = useState("");
  const [coolTarget, setCoolTarget] = useState<LeadTemperature>("warm");
  const [coolReason, setCoolReason] = useState("");

  // Internal note append
  const [newNoteBody, setNewNoteBody] = useState("");

  // Reopen
  const [reopenReason, setReopenReason] = useState("");

  // Messages
  const [messages, setMessages] = useState<BookingMessage[]>(initialMessages);
  const [messageText, setMessageText] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  // Descoped: single-Admin no approver gating required
  const canApprove = true;
  const [showInterestedPreview, setShowInterestedPreview] = useState(false);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  const bookingAgentId = (booking as any).agentId ?? null;
  const [syncedUpdatedAt, setSyncedUpdatedAt] = useState(booking.updatedAt.toISOString());
  useEffect(() => {
    const fresh = booking.updatedAt.toISOString();
    if (fresh !== syncedUpdatedAt) {
      setSyncedUpdatedAt(fresh);
      setExpectedUpdatedAt(fresh);
      setSelectedAgentId(bookingAgentId ?? "");
    }
  }, [booking.updatedAt, bookingAgentId, syncedUpdatedAt]);

  // Single-admin: internal assignment removed no assignedTo sync needed
  const visitorRawForMatch = (booking.agentName ?? "") as string;
  const matchedAgentForVisitor = useMemo(() => {
    const raw = visitorRawForMatch.trim().toLowerCase();
    if (!raw) return null;
    return agents.find((a) => a.name.toLowerCase().includes(raw) || raw.includes(a.name.toLowerCase())) ?? null;
  }, [agents, visitorRawForMatch]);

  const filteredAgents = useMemo(() => {
    const q = agentQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return agents.filter((a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)).slice(0, 8);
  }, [agents, agentQuery]);

  async function run(action: string, payload: Record<string, unknown> = {}) {
    setBusy(action);
    setError(null);
    setConflict(false);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, expectedUpdatedAt, ...payload }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setConflict(true);
        setError(data.error ?? "This booking changed elsewhere. Refresh to see the latest.");
        return;
      }
      if (res.status === 423) {
        setError(data.error ?? "Locked reopen required.");
        return;
      }
      if (res.status === 403) {
        setError(data.error ?? "Not allowed approver role required.");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      setLastEmail(data.emailResult ?? null);
      setExpectedUpdatedAt(data.booking.updatedAt);
      // reset transient
      setReviewNote("");
      setReopenReason("");
      setCoolReason("");
      setEscalateNote("");
      setNewNoteBody("");
      setAssignNote("");
      setActiveNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function sendMessage() {
    if (!messageText.trim() || messageSending) return;
    setMessageSending(true);
    setMessageError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send message");
      setMessages((m) => [...m, data.message]);
      setMessageText("");
      router.refresh();
    } catch (err) {
      setMessageError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setMessageSending(false);
    }
  }

  const status = booking.status;
  const showReview =
    isTransitionAllowed("approve", status) ||
    isTransitionAllowed("hold", status) ||
    isTransitionAllowed("under_review", status) ||
    isTransitionAllowed("reschedule", status);
  const showMarkActive = isTransitionAllowed("mark_active", status);
  const showOutcome = isTransitionAllowed("record_outcome", status);
  const currentRank = temperatureRank[booking.leadTemperature];
  const escalationTargets = temperatureOrder.filter((t) => temperatureRank[t] > currentRank);
  const coolTargets = (["cold", "warm"] as LeadTemperature[]).filter((t) => temperatureRank[t] < currentRank);

  if (isLocked) {
    return (
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-center justify-between gap-4">
            <span>{error}</span>
            {conflict && (
              <button onClick={() => router.refresh()} className="shrink-0 text-xs bg-red-700 text-white rounded-full px-3 py-1">
                Refresh
              </button>
            )}
          </div>
        )}
        <div className="bg-white border border-[var(--line)] rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-[var(--ink)] mb-2">🔒 Booking locked</h2>
          <p className="text-sm text-[var(--ink-muted)]">This booking is closed. Use Reopen to make changes requires a reason and is logged.</p>
          <div className="mt-4">
              <label className="block text-xs text-[var(--ink-muted)] mb-1">Reason to reopen (required)</label>
              <textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                rows={2}
                placeholder="e.g. Client requested correction, sale not actually completed"
                className="w-full border border-[var(--line)] rounded-xl px-3 py-2 text-sm"
              />
              <button
                onClick={() => run("reopen", { reason: reopenReason })}
                disabled={busy !== null || reopenReason.trim().length < 3}
                className="mt-3 text-sm bg-[var(--gold-600)] text-white rounded-full px-5 py-2 font-medium disabled:opacity-50"
              >
                {busy === "reopen" ? "Reopening…" : "Reopen booking"}
              </button>
            </div>
          </div>
        {/* Messaging read-only still visible via parent */}
        <div className="bg-white border border-[var(--line)] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--ink)]">Messaging</h2>
            <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--line)] text-[var(--ink-muted)]">Closed read-only</span>
          </div>
          <p className="text-xs text-[var(--ink-muted)]">Thread is locked for audit. Reopen to post again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-center justify-between gap-4">
          <span>{error}</span>
          {conflict && (
            <button onClick={() => router.refresh()} className="shrink-0 text-xs bg-red-700 text-white rounded-full px-3 py-1">
              Refresh
            </button>
          )}
        </div>
      )}

      {showReview && (
        <div className="bg-[var(--cream-elevated)] border border-[var(--line)] rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--ink)] flex items-center gap-2">
            <span className="h-6 w-6 rounded-md bg-[var(--forest-800)] text-white grid place-items-center text-xs">◎</span>
            Review
            <span className="text-xs font-normal text-[var(--ink-muted)]">· status transitions (separate from Company Agent binding)</span>
          </h2>
          <p className="text-xs text-[var(--ink-muted)]">Use this tile to change booking status. Company Agent binding is in the tile below. One shared note is applied to whichever review action you click.</p>

          <div>
            <label className="block text-xs text-[var(--ink-muted)] mb-1">Note for next action (shared)</label>
            <input
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Reason or context applied to whichever action you click"
              className="w-full border border-[var(--line)] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--forest-600)]"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {isTransitionAllowed("approve", status) && (
              <button
                onClick={() => run("approve", { note: reviewNote || undefined })}
                disabled={busy !== null || !canApprove}
                title={!canApprove ? "Approver required" : undefined}
                className="text-sm bg-[var(--forest-800)] text-white rounded-full px-5 py-2 font-medium disabled:opacity-50"
              >
                {busy === "approve" ? "Approving…" : "Approve"}
              </button>
            )}
            {isTransitionAllowed("hold", status) && (
              <button
                onClick={() => run("hold", { note: reviewNote || undefined })}
                disabled={busy !== null}
                className="text-sm bg-white border border-[var(--line)] rounded-full px-5 py-2 font-medium hover:bg-[var(--cream)] disabled:opacity-50"
              >
                {busy === "hold" ? "Updating…" : "Put on hold"}
              </button>
            )}
            {isTransitionAllowed("under_review", status) && (
              <button
                onClick={() => run("under_review", { note: reviewNote || undefined })}
                disabled={busy !== null}
                className="text-sm bg-white border border-[var(--line)] rounded-full px-5 py-2 font-medium hover:bg-[var(--cream)] disabled:opacity-50"
              >
                {busy === "under_review" ? "Updating…" : "Mark under review"}
              </button>
            )}
          </div>

          {isTransitionAllowed("reschedule", status) && (
            <div className="border-t border-[var(--line)] pt-4">
              <p className="text-xs font-medium text-[var(--ink)] mb-2">Reschedule</p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs text-[var(--ink-muted)] mb-1">New date</label>
                  <input
                    type="date"
                    value={rescheduledDate}
                    onChange={(e) => setRescheduledDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="border border-[var(--line)] rounded-xl px-2.5 py-2 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--ink-muted)] mb-1">New time</label>
                  <select
                    value={rescheduledTime}
                    onChange={(e) => setRescheduledTime(e.target.value)}
                    className="border border-[var(--line)] rounded-xl px-2.5 py-2 text-sm bg-white"
                  >
                    <option value="" disabled>Select a time</option>
                    {timeSlots.map((slot) => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={notifyClient} onChange={(e) => setNotifyClient(e.target.checked)} />
                  Notify client
                </label>
                <button
                  onClick={() => run("reschedule", { rescheduledDate, rescheduledTime, note: reviewNote || undefined, notifyClient })}
                  disabled={busy !== null || !rescheduledDate || !rescheduledTime}
                  className="text-sm bg-[var(--plum-600)] text-white rounded-full px-5 py-2 font-medium disabled:opacity-50"
                >
                  {busy === "reschedule" ? "Rescheduling…" : "Reschedule"}
                </button>
              </div>
              <p className="text-xs text-[var(--ink-muted)] mt-2">⚠ If the assigned agent has another inspection within ±2h, you’ll be warned. Client email is on by default.</p>
            </div>
          )}
        </div>
      )}

      {showMarkActive && (
        <div className="bg-[var(--cream-elevated)] border border-[var(--line)] rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-[var(--ink)] flex items-center gap-2 mb-4">
            <span className="h-6 w-6 rounded-md bg-teal-600 text-white grid place-items-center text-xs">✓</span>
            Mark inspection as held
          </h2>
          <textarea
            value={activeNote}
            onChange={(e) => setActiveNote(e.target.value)}
            placeholder="What happened at the inspection?"
            rows={3}
            className="w-full border border-[var(--line)] rounded-xl px-3 py-2 text-sm"
          />
          <button
            onClick={() => run("mark_active", { internalNote: activeNote })}
            disabled={busy !== null || !activeNote.trim()}
            className="mt-3 text-sm bg-teal-700 text-white rounded-full px-5 py-2 font-medium disabled:opacity-50"
          >
            {busy === "mark_active" ? "Saving…" : "Mark as active"}
          </button>
        </div>
      )}

      {showOutcome && (
        <div className="bg-[var(--cream-elevated)] border border-[var(--line)] rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-[var(--ink)] flex items-center gap-2 mb-3">
            <span className="h-6 w-6 rounded-md bg-[var(--forest-600)] text-white grid place-items-center text-xs">★</span>
            Record sale outcome
          </h2>
          <p className="text-xs text-[var(--ink-muted)] mb-3">Active → Close. Includes subscription-form message for Interested.</p>
          <div className="flex gap-3 flex-wrap items-center">
            <button
              onClick={() => run("record_outcome", { outcome: "sold", note: reviewNote || undefined })}
              disabled={busy !== null}
              className="text-sm bg-[var(--forest-800)] text-white rounded-full px-5 py-2 font-medium disabled:opacity-50"
            >
              Sold
            </button>
            <button
              onClick={() => {
                if (!showInterestedPreview) {
                  setShowInterestedPreview(true);
                  return;
                }
                run("record_outcome", { outcome: "interested", note: reviewNote || undefined });
              }}
              disabled={busy !== null}
              className="text-sm bg-[var(--gold-600)] text-white rounded-full px-5 py-2 font-medium disabled:opacity-50"
            >
              {busy === "record_outcome" ? "Saving…" : "Interested"}
            </button>
            <button
              onClick={() => run("record_outcome", { outcome: "not_sold", note: reviewNote || undefined })}
              disabled={busy !== null}
              className="text-sm bg-white border border-[var(--line)] rounded-full px-5 py-2 font-medium disabled:opacity-50"
            >
              Not sold
            </button>
          </div>
          {showInterestedPreview && (
            <div className="mt-4 p-4 rounded-xl bg-[var(--cream)] border border-[var(--line)] text-sm">
              <div className="font-medium text-[var(--ink)] mb-2">Preview Interested message to client</div>
              <p className="text-[var(--ink)] leading-relaxed">
                Thank you for visiting <strong>{"{{property_name}}"}</strong> with Belgrove Homes. To formalize your interest, please complete the subscription form here:{" "}
                <a href="https://tally.so/r/RG9ryp" className="text-[var(--forest-800)] underline font-medium">https://tally.so/r/RG9ryp</a>. You&#39;re also welcome to visit our office in person. Please note: allocation is confirmed physically or digitally once your payment has been received. Our Admin team will be in touch shortly.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => run("record_outcome", { outcome: "interested", note: reviewNote || undefined })}
                  disabled={busy !== null}
                  className="text-sm bg-[var(--gold-600)] text-white rounded-full px-4 py-2 font-medium disabled:opacity-50"
                >
                  {busy === "record_outcome" ? "Sending…" : "Confirm & send"}
                </button>
                <button onClick={() => setShowInterestedPreview(false)} className="text-sm bg-white border border-[var(--line)] rounded-full px-4 py-2">
                  Cancel
                </button>
              </div>
              <p className="text-xs text-[var(--ink-muted)] mt-2">Logged as a System Timeline entry exact text stays auditable.</p>
            </div>
          )}
        </div>
      )}

      {/* Company Agent canonical typeahead */}
      <div id="assign-agent" className="bg-[var(--cream-elevated)] border border-[var(--line)] rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-[var(--ink)] flex items-center gap-2">
          <span className="h-6 w-6 rounded-md bg-[var(--forest-800)] text-white grid place-items-center text-xs">◈</span>
          Company Agent
          <span className="text-xs font-normal text-[var(--ink-muted)]">· typeahead against Agents DB</span>
        </h2>
        <p className="text-xs text-[var(--ink-muted)] mt-1">Binding source of truth is the Agents table. Visitor’s raw text is shown read-only below; confirm match explicitly.</p>

        {agents.length === 0 ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mt-4">No company agents yet <a href="/admin/agents" className="underline">add agents</a> first.</p>
        ) : (
          <>
            {matchedAgentForVisitor && !booking.agentId && (
              <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3">
                <span className="text-xs text-amber-900">
                  Visitor typed “{visitorRawForMatch}” matches <strong>{matchedAgentForVisitor.name}</strong> ({matchedAgentForVisitor.category === "hire_purchase" ? "Hire Purchase" : "Staff"})
                </span>
                <button onClick={() => setSelectedAgentId(matchedAgentForVisitor.id)} className="text-xs bg-white border border-amber-300 rounded-full px-3 py-1 font-medium">
                  Use this
                </button>
              </div>
            )}
            <div className="mt-4">
              <label className="block text-xs text-[var(--ink-muted)] mb-1">Search agents (type ≥2 letters)</label>
              <input
                value={agentQuery}
                onChange={(e) => setAgentQuery(e.target.value)}
                placeholder="Type name or email…"
                className="w-full border border-[var(--line)] rounded-xl px-3 py-2 text-sm bg-white"
              />
              {agentQuery.trim().length >= 2 && (
                <div className="mt-2 max-h-40 overflow-y-auto border border-[var(--line)] rounded-xl bg-white divide-y divide-[var(--line)]">
                  {filteredAgents.length === 0 ? (
                    <div className="px-3 py-3 text-xs text-[var(--ink-muted)]">No matches</div>
                  ) : (
                    filteredAgents.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => {
                          setSelectedAgentId(a.id);
                          setAgentQuery(a.name);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--cream)] flex items-center justify-between ${selectedAgentId === a.id ? "bg-[var(--cream)] font-medium" : ""}`}
                      >
                        <span>{a.name} · {a.category === "hire_purchase" ? "Hire Purchase" : "Staff"}</span>
                        <span className="text-xs text-[var(--ink-muted)]">{a.email}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
              {selectedAgentId && (
                <div className="mt-2 p-2 rounded-xl bg-[var(--cream)] border border-[var(--line)] text-xs flex items-center justify-between">
                  <span>Selected: <strong>{agents.find((a) => a.id === selectedAgentId)?.name}</strong></span>
                  <button onClick={() => { setSelectedAgentId(""); setAgentQuery(""); }} className="text-xs underline">Clear</button>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={assignNote}
                onChange={(e) => setAssignNote(e.target.value)}
                placeholder="Note to agent (optional)"
                className="border border-[var(--line)] rounded-xl px-3 py-2 text-sm flex-1 min-w-[160px] bg-white"
              />
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={assignSilent} onChange={(e) => setAssignSilent(e.target.checked)} />
                Silent (no email)
              </label>
            </div>

            {selectedAgentId && !assignSilent && (
              <div className="mt-3">
                {!showPreview ? (
                  <button onClick={() => setShowPreview(true)} className="text-xs text-[var(--gold-600)] underline">Preview email before sending</button>
                ) : (
                  <div className="p-3 rounded-xl bg-[var(--cream)] border border-[var(--line)] text-xs">
                    <div className="font-medium text-[var(--ink)]">Email preview</div>
                    <p className="text-[var(--ink-muted)] mt-1">To: {agents.find((a) => a.id === selectedAgentId)?.email}</p>
                    <p className="text-[var(--ink-muted)]">Subject: New client assigned {booking.id.slice(0, 8)}</p>
                    <p className="text-[var(--ink)] mt-2">Client details will be sent to the agent. {assignNote ? `Note: “${assignNote}”` : ""}</p>
                    <button onClick={() => setShowPreview(false)} className="text-xs underline mt-2">Hide preview</button>
                  </div>
                )}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => run("assign_agent", { agentId: selectedAgentId || null, note: assignNote || undefined, silent: assignSilent })}
                disabled={busy !== null}
                className="text-sm bg-[var(--forest-800)] text-white rounded-full px-5 py-2 font-medium disabled:opacity-50"
              >
                {busy === "assign_agent" ? "Saving…" : selectedAgentId ? (assignSilent ? "Reassign silently" : selectedAgentId === booking.agentId ? "Re-assign & notify" : "Assign & notify") : "Clear assignment"}
              </button>
              {booking.agentId && (
                <button
                  onClick={() => run("assign_agent", { agentId: null, note: assignNote || undefined })}
                  disabled={busy !== null}
                  className="text-sm bg-white border border-[var(--line)] rounded-full px-4 py-2 font-medium disabled:opacity-50"
                  title="Remove current company-agent assignment (keeps visitor raw text)"
                >
                  Unassign
                </button>
              )}
              {booking.agentId && !booking.agentConfirmedAt && (
                <button
                  onClick={() => run("confirm_agent", {})}
                  disabled={busy !== null}
                  className="text-sm bg-[var(--gold-600)] text-white rounded-full px-5 py-2 font-medium disabled:opacity-50"
                  title="Mark this binding as verified prevents accidental re-match"
                >
                  Confirm match
                </button>
              )}
            </div>
            <p className="text-xs text-[var(--ink-muted)] mt-2">
              Current: <span className="font-medium text-[var(--ink)]">{booking.agentName || "None"}</span> {booking.agentId ? <span className="text-emerald-700">· Company agent assigned</span> : <span className="text-amber-700">· Not yet assigned</span>}
              {booking.agentId && !booking.agentConfirmedAt && <span className="text-amber-700"> confirm when verified</span>}
              {booking.agentId && booking.agentConfirmedAt && <span className="text-emerald-700"> confirmed</span>}
            </p>
          </>
        )}
      </div>

      {/* Messaging follow-up with assigned agent */}
      <div className="bg-[var(--cream-elevated)] border border-[var(--line)] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--ink)] flex items-center gap-2">
            <span className="h-7 w-7 rounded-full bg-[var(--forest-800)] text-white grid place-items-center text-xs">💬</span>
            Messaging
          </h2>
          <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--cream)] border border-[var(--line)] text-[var(--ink-muted)]">{messages.length} messages</span>
        </div>
        {messages.length === 0 ? (
          <div className="py-6 text-center border border-dashed border-[var(--line)] rounded-xl bg-[var(--cream)]/50">
            <p className="text-sm text-[var(--ink-muted)]">No messages yet</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {messages.map((m) => (
              <div key={m.id} className="flex gap-3 p-3 rounded-xl border border-[var(--line)] bg-[var(--cream)]/60">
                <div className="h-8 w-8 rounded-full bg-[var(--forest-800)] text-white grid place-items-center text-xs shrink-0 font-medium">
                  {m.authorName.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-[var(--ink)]">{m.authorName}</span>
                    <span className="text-xs text-[var(--ink-muted)]">{new Date(m.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-[var(--ink)] mt-1 whitespace-pre-wrap break-words">{m.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4">
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Post a follow-up note…"
            rows={3}
            className="w-full border border-[var(--line)] rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--forest-600)] resize-none"
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-[var(--ink-muted)]">{messageText.length}/5000</span>
            <button onClick={sendMessage} disabled={!messageText.trim() || messageSending} className="text-sm bg-[var(--forest-800)] text-white rounded-full px-5 py-2.5 font-medium disabled:opacity-50">
              {messageSending ? "Sending…" : "Send message"}
            </button>
          </div>
          {messageError && <p className="text-xs text-[var(--red-600)] mt-2">{messageError}</p>}
        </div>
      </div>

      {/* Internal notes append-only */}
      <div className="bg-[var(--cream-elevated)] border border-[var(--line)] rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-[var(--ink)] flex items-center gap-2 mb-3">
          <span className="h-6 w-6 rounded-md bg-[var(--gold-600)] text-white grid place-items-center text-xs">✎</span>
          Internal notes
          <span className="text-xs font-normal text-[var(--ink-muted)]">· append-only, attributed</span>
        </h2>
        {internalNotes.length > 0 ? (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1 mb-3">
            {internalNotes.map((n) => (
              <div key={n.id} className="p-2.5 rounded-xl bg-[var(--cream)] border border-[var(--line)] text-sm">
                <div className="text-xs text-[var(--ink-muted)]">{n.authorName} · {new Date(n.createdAt).toLocaleString()}</div>
                <div className="text-[var(--ink)] whitespace-pre-wrap">{n.body}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--ink-muted)] mb-3">No internal notes yet.</p>
        )}
        <div className="flex gap-2">
          <input
            value={newNoteBody}
            onChange={(e) => setNewNoteBody(e.target.value)}
            placeholder="Add an internal note…"
            className="flex-1 border border-[var(--line)] rounded-xl px-3 py-2 text-sm bg-white"
          />
          <button
            onClick={() => run("add_note", { body: newNoteBody })}
            disabled={!newNoteBody.trim() || busy !== null}
            className="text-sm bg-white border border-[var(--line)] rounded-full px-4 py-2 font-medium disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      {/* Lead temperature */}
      <div className="bg-[var(--cream-elevated)] border border-[var(--line)] rounded-2xl p-6">
        <h2 className="text-sm font-semibold text-[var(--ink)] flex items-center gap-2 mb-3">
          <span className="h-6 w-6 rounded-md bg-[var(--red-600)] text-white grid place-items-center text-xs">◐</span>
          Lead temperature
        </h2>
        <p className="text-sm text-[var(--ink-muted)] mb-3">
          Currently <span className="font-medium capitalize text-[var(--ink)]">{booking.leadTemperature}</span>. Escalate manually, cool down with reason. Hot → warm automatically after <strong>30 days</strong> with no logged contact (no message, note, or status change) checked daily; manual cool-down also available below.
        </p>
        {escalationTargets.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <input
              value={escalateNote}
              onChange={(e) => setEscalateNote(e.target.value)}
              placeholder="Note (optional)"
              className="border border-[var(--line)] rounded-xl px-3 py-2 text-sm flex-1 min-w-[160px] bg-white"
            />
            {escalationTargets.map((t) => (
              <button key={t} onClick={() => run("escalate_lead", { leadTemperature: t, note: escalateNote || undefined })} disabled={busy !== null} className="text-sm bg-[var(--red-600)] text-white rounded-full px-4 py-2 font-medium disabled:opacity-50">
                Mark as {t}
              </button>
            ))}
          </div>
        )}
        {coolTargets.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <select value={coolTarget} onChange={(e) => setCoolTarget(e.target.value as LeadTemperature)} className="border border-[var(--line)] rounded-xl px-3 py-2 text-sm bg-white">
              {coolTargets.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input
              value={coolReason}
              onChange={(e) => setCoolReason(e.target.value)}
              placeholder="Reason to cool down (required)"
              className="border border-[var(--line)] rounded-xl px-3 py-2 text-sm flex-1 min-w-[160px] bg-white"
            />
            <button
              onClick={() => run("cool_down", { leadTemperature: coolTarget, note: coolReason })}
              disabled={busy !== null || !coolReason.trim()}
              className="text-sm bg-white border border-[var(--line)] rounded-full px-4 py-2 font-medium disabled:opacity-50"
            >
              Cool down
            </button>
          </div>
        ) : (
          <p className="text-xs text-[var(--ink-muted)]">At lowest temperature nothing to cool.</p>
        )}
      </div>

      {/* Single-admin: no internal assignment Edit fields removed. Agent & notes handled above. */}
      <p className="text-xs text-[var(--ink-muted)] px-1">All edits are audited. Agent assignment and notes are managed in their dedicated panels above (append-only).</p>

      {lastEmail && !conflict && (
        <div className="text-xs">
          {lastEmail.sent && <p className="text-emerald-700">Email sent.</p>}
          {!lastEmail.sent && lastEmail.error && <p className="text-[var(--red-600)]">Email failed: {lastEmail.error}</p>}
        </div>
      )}
    </div>
  );
}
