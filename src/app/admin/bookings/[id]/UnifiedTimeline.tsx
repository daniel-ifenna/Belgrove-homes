"use client";

import { useState } from "react";
import { statusLabels } from "@/lib/booking-ui";
import { actionLabels, type BookingAction } from "@/lib/booking-transitions";
import { formatDateTime } from "@/lib/booking-ui";

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
    <div className="bg-[var(--cream-elevated)] border border-[var(--line)] rounded-2xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-semibold text-[var(--ink)]">Timeline</h2>
        <div className="flex flex-wrap gap-1.5">
          {(["all", "status_change", "message", "note", "lead"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-1 rounded-full text-xs border ${filter === k ? "bg-[var(--forest-800)] text-white border-[var(--forest-800)]" : "bg-white border-[var(--line)] text-[var(--ink-muted)] hover:bg-[var(--cream)]"}`}
            >
              {k === "all" ? "All" : k === "status_change" ? "Status" : k === "lead" ? "Lead" : k[0].toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--ink-muted)] py-6 text-center">No entries for this filter.</p>
      ) : (
        <ol className="space-y-3">
          {filtered.map((entry) => {
            if (entry.kind === "message") {
              const m = entry.data as Msg;
              return (
                <li key={`m-${m.id}`} className="flex gap-3 p-3 rounded-xl border border-[var(--line)] bg-[var(--cream)]/40">
                  <span className="h-7 w-7 rounded-full bg-[var(--forest-800)] text-white grid place-items-center text-[10px] shrink-0">💬</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-[var(--ink)]">{m.authorName} message</span>
                      <span className="text-xs text-[var(--ink-muted)]">{formatDateTime(m.createdAt)}</span>
                    </div>
                    <p className="text-sm text-[var(--ink)] mt-1 whitespace-pre-wrap break-words">{m.message}</p>
                  </div>
                </li>
              );
            }
            if (entry.kind === "note") {
              const n = entry.data as Note;
              return (
                <li key={`n-${n.id}`} className="flex gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50/50">
                  <span className="h-7 w-7 rounded-full bg-[var(--gold-600)] text-white grid place-items-center text-[10px] shrink-0">✎</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-[var(--ink)]">{n.authorName} internal note</span>
                      <span className="text-xs text-[var(--ink-muted)]">{formatDateTime(n.createdAt)}</span>
                    </div>
                    <p className="text-sm text-[var(--ink)] mt-1 whitespace-pre-wrap break-words">{n.body}</p>
                  </div>
                </li>
              );
            }
            const a = entry.data as Activity;
            return (
              <li key={a.id} className="border-l-2 border-[var(--line)] pl-4 relative py-1">
                <span className="absolute -left-[5px] top-2 w-2 h-2 rounded-full bg-[var(--forest-600)]" />
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-sm text-[var(--ink)]">
                    <span className="font-medium">{a.actorName}</span>{" "}
                    {actionLabels[a.action as BookingAction]?.toLowerCase() ?? a.action}
                    {a.fromStatus !== a.toStatus && (
                      <span className="text-[var(--ink-muted)]">
                        {" "}
                        ({statusLabels[a.fromStatus]} → {statusLabels[a.toStatus]})
                      </span>
                    )}
                  </p>
                  <span className="text-xs text-[var(--ink-muted)] shrink-0">{formatDateTime(a.createdAt)}</span>
                </div>
                {a.note && <p className="text-sm text-[var(--ink-muted)] mt-1 whitespace-pre-wrap">{a.note}</p>}
                {a.emailSent === true && <p className="text-xs text-emerald-700 mt-1">Email sent</p>}
                {a.emailSent === false && <p className="text-xs text-[var(--red-600)] mt-1">Email failed: {a.emailError}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
