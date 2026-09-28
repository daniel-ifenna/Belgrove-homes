"use client";

import { useState } from "react";
import { statusLabels } from "@/lib/booking-ui";
import { actionLabels, type BookingAction } from "@/lib/booking-transitions";
import { formatDateTime } from "@/lib/booking-ui";
import PanelHeader from "@/components/admin/PanelHeader";

type Activity = {
  id: string;
  actorName: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  note: string | null;
  emailSent: boolean | null;
  emailError: string | null;
  createdAt: Date | string;
};

type Msg = { id: string; authorName: string; message: string; createdAt: Date | string };
type Note = { id: string; authorName: string; body: string; createdAt: Date | string };

function DotIcon({ kind }: { kind: "status" | "lead" | "message" | "note" }) {
  const common = "absolute -left-3 top-0 h-6 w-6 rounded-full bg-white border grid place-items-center shrink-0";
  if (kind === "message") {
    return (
      <span className={`${common} border-[var(--ops-border)] text-[var(--ops-primary)]`}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
      </span>
    );
  }
  if (kind === "note") {
    return (
      <span className={`${common} border-[var(--border-hairline)] text-[var(--accent-gold)]`}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
      </span>
    );
  }
  if (kind === "lead") {
    return (
      <span className={`${common} border-[#C89B3C] bg-[#C89B3C] text-white`}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v10" /><circle cx="12" cy="17" r="4" /></svg>
      </span>
    );
  }
  return (
    <span className={`${common} border-[var(--ops-primary)] bg-[var(--ops-primary)] text-white`}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 7h13M8 12h13M8 17h13" /><circle cx="4" cy="7" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="17" r="1" /></svg>
    </span>
  );
}

export default function UnifiedTimeline({
  activities,
  messages,
  internalNotes,
}: {
  activities: Activity[];
  messages: Msg[];
  internalNotes: Note[];
}) {
  const [filter, setFilter] = useState<"all" | "status_change" | "note" | "message" | "lead">("all");

  const timeline = [
    ...activities.map((a) => ({ kind: "activity" as const, at: new Date(a.createdAt), data: a })),
    ...messages.map((m) => ({ kind: "message" as const, at: new Date(m.createdAt), data: m })),
    ...internalNotes.map((n) => ({ kind: "note" as const, at: new Date(n.createdAt), data: n })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  const filtered = timeline.filter((e) => {
    if (filter === "all") return true;
    if (filter === "message") return e.kind === "message";
    if (filter === "note") return e.kind === "note";
    if (filter === "status_change") return e.kind === "activity" && (e.data as Activity).fromStatus !== (e.data as Activity).toStatus;
    if (filter === "lead") return e.kind === "activity" && ["escalate_lead", "cool_down"].includes((e.data as Activity).action);
    return true;
  });

  return (
    <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-6 shadow-[var(--ops-shadow-sm)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PanelHeader
          title="Timeline"
          description="Every status change, message, note and lead event — newest first."
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" /></svg>
          }
        />
        <div className="flex flex-wrap gap-1.5">
          {(["all", "status_change", "message", "note", "lead"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${filter === k ? "bg-[var(--ops-primary)] text-white border-[var(--ops-primary)]" : "bg-white border-[var(--ops-border)] text-[var(--ops-muted)] hover:text-[var(--ops-text)]"}`}
            >
              {k === "all" ? "All" : k === "status_change" ? "Status" : k === "lead" ? "Lead" : k[0].toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="mt-5 py-10 text-center rounded-[12px] border border-dashed border-[var(--ops-border)] bg-[var(--ops-bg)]">
          <p className="public text-[13px] text-[var(--ops-muted)]">No entries for this filter.</p>
        </div>
      ) : (
        <ol className="mt-6 ml-3 border-l border-[var(--ops-border)]">
          {filtered.map((entry) => {
            if (entry.kind === "message") {
              const m = entry.data as Msg;
              return (
                <li key={`m-${m.id}`} className="relative pl-7 pb-5 last:pb-0">
                  <DotIcon kind="message" />
                  <div className="rounded-xl border border-[var(--ops-border)] bg-[var(--ops-bg)]/50 px-4 py-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[13px] font-medium text-[var(--ops-text)]">{m.authorName} <span className="font-normal text-[var(--ops-muted)]">· message</span></span>
                      <span className="mono text-[11px] text-[var(--ops-muted)] shrink-0">{formatDateTime(m.createdAt)}</span>
                    </div>
                    <p className="text-[13px] text-[var(--ops-text)] mt-1 whitespace-pre-wrap break-words">{m.message}</p>
                  </div>
                </li>
              );
            }
            if (entry.kind === "note") {
              const n = entry.data as Note;
              return (
                <li key={`n-${n.id}`} className="relative pl-7 pb-5 last:pb-0">
                  <DotIcon kind="note" />
                  <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-cream-alt)] px-4 py-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[13px] font-medium text-[var(--ops-text)]">{n.authorName} <span className="font-normal text-[var(--ops-muted)]">· internal note</span></span>
                      <span className="mono text-[11px] text-[var(--ops-muted)] shrink-0">{formatDateTime(n.createdAt)}</span>
                    </div>
                    <p className="text-[13px] text-[var(--ops-text)] mt-1 whitespace-pre-wrap break-words">{n.body}</p>
                  </div>
                </li>
              );
            }
            const a = entry.data as Activity;
            const isLead = ["escalate_lead", "cool_down"].includes(a.action);
            return (
              <li key={a.id} className="relative pl-7 pb-5 last:pb-0">
                <DotIcon kind={isLead ? "lead" : "status"} />
                <div className="flex items-baseline justify-between gap-4 flex-wrap">
                  <p className="text-[13px] text-[var(--ops-text)]">
                    <span className="font-medium">{a.actorName}</span>{" "}
                    <span className="text-[var(--ops-muted)]">{actionLabels[a.action as BookingAction]?.toLowerCase() ?? a.action}</span>
                    {a.fromStatus !== a.toStatus && (
                      <span className="text-[var(--ops-muted)]">
                        {" "}
                        ({statusLabels[a.fromStatus]} → {statusLabels[a.toStatus]})
                      </span>
                    )}
                  </p>
                  <span className="mono text-[11px] text-[var(--ops-muted)] shrink-0">{formatDateTime(a.createdAt)}</span>
                </div>
                {a.note && <p className="text-[13px] text-[var(--ops-muted)] mt-1 whitespace-pre-wrap bg-white border border-[var(--ops-border)] rounded-lg px-3 py-2">{a.note}</p>}
                {a.emailSent === true && <p className="mono text-[11px] text-[#1F6B3E] mt-1.5">✓ Email sent</p>}
                {a.emailSent === false && <p className="mono text-[11px] text-[#A6402F] mt-1.5">Email failed: {a.emailError}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
