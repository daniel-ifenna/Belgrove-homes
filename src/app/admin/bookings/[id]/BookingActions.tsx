"use client";
/* eslint-disable react-hooks/set-state-in-effect -- intentional prop->state sync after router.refresh */

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { isTransitionAllowed, temperatureRank } from "@/lib/booking-transitions";
import { timeSlots } from "@/lib/content";
import { formatLagos } from "@/lib/time";
import PanelHeader from "@/components/admin/PanelHeader";
import type { BookingStatus, LeadTemperature } from "@/generated/prisma/client";

type Booking = {
  id: string;
  ref: string;
  status: BookingStatus;
  leadTemperature: LeadTemperature;
  agentName: string | null;
  agentId?: string | null;
  assignedToId: string | null;
  updatedAt: Date;
  lockedAt?: Date | string | null;
  agentConfirmedAt?: Date | string | null;
  outcome?: string | null;
  formConfirmedAt?: Date | string | null;
  inspectedAt?: Date | string | null;
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
  const [activeOverride, setActiveOverride] = useState("");

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
      // Safe-parse: a non-JSON response (proxy/5xx HTML, empty body) must
      // surface as a friendly action error, never a SyntaxError.
      const data = await res.json().catch(() => ({}));
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
      // Stale-page self-heal: when the server returns its current row with
      // a rejection (e.g. "Form already confirmed" because another tab or
      // the transaction flow moved first), resync and refresh so the panel
      // shows the now-available actions instead of a dead button.
      if (!res.ok && data.booking?.updatedAt) {
        setExpectedUpdatedAt(data.booking.updatedAt);
        router.refresh();
      }
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      if (!data.booking) throw new Error("Action failed");
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
      setShowInterestedPreview(false);
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to send message");
      if (!data.message) throw new Error("Failed to send message");
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
          <PanelHeader
            title="Review"
            description="Status transitions: separate from Company Agent binding. One shared note is applied to whichever action you click."
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" /></svg>
            }
          />

          <div>
            <label className="block text-xs text-[var(--ink-muted)] mb-1">Note for next action (shared)</label>
            <input
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Reason or context applied to whichever action you click"
              className="w-full border border-[var(--line)] rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--forest-600)]"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {isTransitionAllowed("approve", status) && (
              <button
                onClick={() => run("approve", { note: reviewNote || undefined })}
                disabled={busy !== null || !canApprove}
                title={!canApprove ? "Approver required" : "Approving will auto-move lead Cold → Warm"}
                className="text-sm bg-[var(--forest-800)] text-white rounded-full px-5 py-2 font-medium disabled:opacity-50"
              >
                {busy === "approve" ? "Approving…" : "Approve → Warm"}
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
            <div id="reschedule-section" className="border-t border-[var(--line)] pt-4">
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
                  className="text-sm bg-[var(--ops-primary)] text-white rounded-full px-5 py-2 font-medium hover:bg-[var(--ops-deep)] disabled:opacity-50"
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
          <PanelHeader
            title="Mark inspection as held"
            description="Record what happened: the inspection joins the conducted list."
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" /></svg>
            }
          />
          <div className="mt-4">
          <textarea
            value={activeNote}
            onChange={(e) => setActiveNote(e.target.value)}
            placeholder="What happened at the inspection?"
            rows={3}
            className="w-full border border-[var(--line)] rounded-xl px-3 py-2 text-sm"
          />
          <input
            value={activeOverride}
            onChange={(e) => setActiveOverride(e.target.value)}
            placeholder="Override reason: only if marking active before the scheduled time"
            className="mt-2 w-full border border-[var(--line)] rounded-xl px-3 py-2 text-sm"
          />
          <button
            onClick={() => run("mark_active", { internalNote: activeNote, overrideReason: activeOverride || undefined })}
            disabled={busy !== null || !activeNote.trim()}
            className="mt-3 text-sm bg-[var(--ops-primary)] text-white rounded-full px-5 py-2 font-medium hover:bg-[var(--ops-deep)] disabled:opacity-50"
          >
            {busy === "mark_active" ? "Saving…" : "Mark as active"}
          </button>
          </div>
        </div>
      )}

      {showOutcome && (
        <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
          <PanelHeader
            title="Record sale outcome"
            description="Interested heats to Hot and stays open; Sold closes silently (confirmation email fires at transaction creation), Not Sold closes with an automated follow-up."
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l7 4v6c0 5-4 9-7 11-3-2-7-6-7-11V6l7-4z" /><path d="M9 12l2 2 4-4" /></svg>
            }
          />
          <div className="mt-4">
          {(() => {
            const ov = (booking as any).outcome as string | null;
            const formDone = !!booking.formConfirmedAt || ov === "sold" || ov === "not_sold";
            const steps = [
              { label: "Interested", done: !!ov },
              { label: "Form confirmed", done: formDone },
              { label: "Sold / Not sold", done: ov === "sold" || ov === "not_sold" },
            ];
            return (
              <ol className="flex items-center gap-1.5 mb-4" aria-label="Outcome progress">
                {steps.map((s, i) => (
                  <li key={s.label} className="flex items-center gap-1.5">
                    {i > 0 && <span className="w-4 h-px bg-[var(--ops-border)]" aria-hidden="true" />}
                    <span className={`inline-flex items-center gap-1.5 mono text-[10px] tracking-wide uppercase px-2.5 py-1 rounded-full border ${s.done ? "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]" : "bg-white text-[var(--ops-muted)] border-[var(--ops-border)]"}`}>
                      {s.done ? "✓ " : `${i + 1} · `}{s.label}
                    </span>
                  </li>
                ))}
              </ol>
            );
          })()}
          {(booking as any).outcome === "interested" ? (
            booking.formConfirmedAt ? (
            <div className="mt-4 p-4 rounded-[12px] bg-[#FFFBEB] border border-[#FDE68A]">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-[#C8A04A] text-white grid place-items-center text-[11px]">★</span>
                <span className="text-[13px] font-medium text-[#92400E]">Interested: Hot lead • Awaiting final decision</span>
                <span className="ml-auto px-2 py-1 rounded-full text-[11px] font-medium bg-[#FEF2F2] text-[#9F1239] border border-[#FECACA]">HOT</span>
              </div>
              <p className="public text-[12px] leading-[1.5] text-[#92400E]/80 mt-2">Client signaled as <strong>Interested</strong> and automatically moved to <strong>HOT</strong>. Next, confirm if they <strong>bought (Sold)</strong> or <strong>did not buy (Not Sold)</strong>. The system will send the appropriate automated response and then close.</p>
              <div className="flex gap-3 flex-wrap items-center mt-4">
                <button
                  onClick={() => run("record_outcome", { outcome: "sold", note: reviewNote || undefined })}
                  disabled={busy !== null}
                  className="text-sm bg-[#0D3328] text-white rounded-full px-5 py-2.5 font-medium hover:bg-[#08261E] disabled:opacity-50 shadow-sm"
                >
                  Bought (sold)
                </button>
                <button
                  onClick={() => run("record_outcome", { outcome: "not_sold", note: reviewNote || undefined })}
                  disabled={busy !== null}
                  className="text-sm bg-white border border-[var(--ops-border)] rounded-full px-5 py-2.5 font-medium hover:bg-[var(--ops-bg)] disabled:opacity-50"
                >
                  Not Sold
                </button>
              </div>
              <p className="mono text-[10px] text-[#92400E]/60 mt-2">Not Sold sends an automated follow-up email before locking; Sold closes without email — confirmation follows at transaction creation.</p>
            </div>
            ) : (
              <div className="mt-4 p-4 rounded-[12px] bg-[#FFFBEB] border border-[#FDE68A]">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-[#C8A04A] text-white grid place-items-center text-[11px]">★</span>
                  <span className="text-[13px] font-medium text-[#92400E]">Interested: Hot lead • Subscription form sent</span>
                  <span className="ml-auto px-2 py-1 rounded-full text-[11px] font-medium bg-[#FEF2F2] text-[#9F1239] border border-[#FECACA]">HOT</span>
                </div>
                <p className="public text-[12px] leading-[1.5] text-[#92400E]/80 mt-2">The client received the subscription form. Confirm they have filled it — Sold / Not Sold unlock after confirmation.</p>
                <div className="flex gap-3 flex-wrap items-center mt-4">
                  <button
                    onClick={() => run("confirm_form", { note: reviewNote || undefined })}
                    disabled={busy !== null}
                    className="text-sm bg-[#0D3328] text-white rounded-full px-5 py-2.5 font-medium hover:bg-[#08261E] disabled:opacity-50 shadow-sm"
                  >
                    {busy === "confirm_form" ? "Confirming…" : "Confirm form filled"}
                  </button>
                </div>
              </div>
            )
          ) : (
            <>
              <p className="public text-[12px] leading-[1.5] text-[var(--ops-muted)] mb-4">Choose the outcome. <span className="font-medium text-[var(--ops-text)]">Interested</span> will auto-heat to <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] bg-[#FEF2F2] text-[#9F1239] border border-[#FECACA]">HOT</span> and stay open for the final Sold / Not Sold step. <span className="font-medium">Sold</span> closes silently (confirmation email fires at transaction creation); <span className="font-medium">Not Sold</span> closes with an automated follow-up email.</p>
              <div className="flex gap-3 flex-wrap items-center">
                <button
                  onClick={() => run("record_outcome", { outcome: "sold", note: reviewNote || undefined })}
                  disabled={busy !== null}
                  className="text-sm bg-[var(--ops-primary)] text-white rounded-full px-5 py-2.5 font-medium hover:bg-[var(--ops-deep)] disabled:opacity-50 shadow-sm"
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
                  className="text-sm bg-[#C8A04A] text-white rounded-full px-5 py-2.5 font-medium hover:bg-[#9A7A2F] disabled:opacity-50 shadow-sm"
                >
                  {busy === "record_outcome" ? "Saving…" : "Interested → Hot"}
                </button>
                <button
                  onClick={() => run("record_outcome", { outcome: "not_sold", note: reviewNote || undefined })}
                  disabled={busy !== null}
                  className="text-sm bg-white border border-[var(--ops-border)] rounded-full px-5 py-2.5 font-medium hover:bg-[var(--ops-bg)] disabled:opacity-50"
                >
                  Not sold
                </button>
              </div>
            </>
          )}
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
        </div>
      )}

      {/* Company Agent canonical typeahead — binding closes once held */}
      <div id="assign-agent" className="bg-[var(--cream-elevated)] border border-[var(--line)] rounded-2xl p-6 scroll-mt-20">
        <PanelHeader
          title="Company Agent"
          description="Typeahead against the Agents table: the visitor's raw text is read-only; confirm the match explicitly."
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>
          }
        />

        {booking.inspectedAt ? (
          <div className="mt-4">
            <p className="text-sm text-[var(--ink-muted)]">
              Current: <span className="font-medium text-[var(--ink)]">{booking.agentName || "None"}</span>
              {booking.agentId ? <span className="text-emerald-700"> · Company agent assigned</span> : null}
              {booking.agentConfirmedAt ? <span className="text-emerald-700"> · confirmed</span> : null}
            </p>
            <p className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)] mt-2">Closed — inspection held. Assignment can no longer be changed.</p>
          </div>
        ) : (
          <>
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

            <div className="mt-3">
              <label className="block mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)] mb-1">Note to agent: will appear in email and internal notes</label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  placeholder="e.g. Please prioritize: client is hot, call within 2 hours"
                  className="border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm flex-1 min-w-[160px] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ops-primary)]/10"
                />
                <label className="flex items-center gap-1.5 text-xs bg-white border border-[var(--ops-border)] rounded-full px-3 py-1.5 cursor-pointer">
                  <input type="checkbox" checked={assignSilent} onChange={(e) => setAssignSilent(e.target.checked)} className="rounded" />
                  Silent (no email)
                </label>
              </div>
              <p className="mono text-[10px] text-[var(--ops-muted)] mt-1.5">Leave a note to give context. It will be saved to the timeline and included in the agent’s email.</p>
            </div>

            {selectedAgentId && !assignSilent && (
              <div className="mt-3">
                {!showPreview ? (
                  <button onClick={() => setShowPreview(true)} className="text-xs text-[var(--gold-600)] underline">Preview email before sending</button>
                ) : (
                  <div className="p-3 rounded-xl bg-[var(--cream)] border border-[var(--line)] text-xs">
                    <div className="font-medium text-[var(--ink)]">Email preview</div>
                    <p className="text-[var(--ink-muted)] mt-1">To: {agents.find((a) => a.id === selectedAgentId)?.email}</p>
                    <p className="text-[var(--ink-muted)]">Subject: New client assigned {booking.ref}</p>
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
          </>
        )}
      </div>

      {/* Messaging follow-up with assigned agent */}
      <div className="bg-[var(--cream-elevated)] border border-[var(--line)] rounded-2xl p-6">
        <div className="flex items-start justify-between gap-3">
          <PanelHeader
            title="Messaging"
            description="Follow-ups are emailed to the assigned agent and logged to the timeline."
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            }
          />
          <span className="mono text-[11px] px-2.5 py-1 rounded-full bg-[var(--ops-bg)] border border-[var(--ops-border)] text-[var(--ops-muted)] shrink-0">{messages.length} messages</span>
        </div>
        {messages.length === 0 ? (
          <div className="mt-4 py-6 text-center border border-dashed border-[var(--line)] rounded-xl bg-[var(--cream)]/50">
            <p className="text-sm text-[var(--ink-muted)]">No messages yet</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3 max-h-72 overflow-y-auto pr-1">
            {messages.map((m) => (
              <div key={m.id} className="flex gap-3 p-3 rounded-xl border border-[var(--line)] bg-[var(--cream)]/60">
                <div className="h-8 w-8 rounded-full bg-[var(--forest-800)] text-white grid place-items-center text-xs shrink-0 font-medium">
                  {m.authorName.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-[var(--ink)]">{m.authorName}</span>
                    <span className="text-xs text-[var(--ink-muted)]">{formatLagos(m.createdAt, "datetime")}</span>
                  </div>
                  <p className="text-sm text-[var(--ink)] mt-1 whitespace-pre-wrap break-words">{m.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4">
          <label className="block mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)] mb-1">Follow-up message: emailed to assigned agent and logged to timeline</label>
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Post a follow-up note… e.g. Client called, wants to reschedule to next week, hot lead"
            rows={3}
            className="w-full border border-[var(--ops-border)] rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--ops-primary)]/10 resize-none"
          />
          <p className="mono text-[10px] text-[var(--ops-muted)] mt-1.5">This will be saved as a message, added to the activity timeline, and emailed to the assigned agent (if any).</p>
          <div className="flex items-center justify-between mt-3">
            <span className="mono text-[11px] text-[var(--ops-muted)]">{messageText.length}/5000</span>
            <button onClick={sendMessage} disabled={!messageText.trim() || messageSending} className="text-sm bg-[var(--ops-primary)] text-white rounded-full px-5 py-2.5 font-medium disabled:opacity-50 hover:bg-[var(--ops-deep)] transition-colors">
              {messageSending ? "Sending…" : "Send message →"}
            </button>
          </div>
          {messageError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">{messageError}</p>}
        </div>
      </div>

      {/* Internal notes append-only */}
      <div id="internal-notes" className="bg-[var(--cream-elevated)] border border-[var(--line)] rounded-2xl p-6">
        <PanelHeader
          title="Internal notes"
          description="Append-only and attributed. Visible to staff only."
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
          }
        />
        {internalNotes.length > 0 ? (
          <div className="mt-4 space-y-2 max-h-48 overflow-y-auto pr-1 mb-3">
            {internalNotes.map((n) => (
              <div key={n.id} className="p-2.5 rounded-xl bg-[var(--cream)] border border-[var(--line)] text-sm">
                    <div className="text-xs text-[var(--ink-muted)]">{n.authorName} · {formatLagos(n.createdAt, "datetime")}</div>
                <div className="text-[var(--ink)] whitespace-pre-wrap">{n.body}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--ink-muted)] mb-3">No internal notes yet.</p>
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
      <div id="lead-temp" className="bg-[var(--cream-elevated)] border border-[var(--line)] rounded-2xl p-6 scroll-mt-24">
        <PanelHeader
          title="Lead temperature"
          description="Escalate manually, or cool down with a reason. Hot cools to Warm automatically after 30 days with no logged contact."
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v10" /><circle cx="12" cy="17" r="4" /></svg>
          }
        />
        <p className="mt-4 text-sm text-[var(--ink-muted)] mb-3">
          Currently <span className="font-medium capitalize text-[var(--ink)]">{booking.leadTemperature}</span>. Escalate manually, or cool down with a reason below.
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
