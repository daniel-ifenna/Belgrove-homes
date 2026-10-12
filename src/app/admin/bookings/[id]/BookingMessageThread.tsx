"use client";
/* eslint-disable react-hooks/set-state-in-effect -- intentional prop->state sync after router.refresh */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatLagos } from "@/lib/time";

type ThreadMessage = { id: string; authorName: string; message: string; createdAt: string | Date };

// Agent follow-up thread: messages are emailed to the assigned agent and
// logged to the timeline. Extracted from BookingActions so the booking page
// can show it on its own Messages tab; the sending logic is unchanged.
export default function BookingMessageThread({
  bookingId,
  initialMessages = [],
  isLocked = false,
}: {
  bookingId: string;
  initialMessages?: ThreadMessage[];
  isLocked?: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [messageText, setMessageText] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  async function sendMessage() {
    if (!messageText.trim() || messageSending) return;
    setMessageSending(true);
    setMessageError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/messages`, {
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

  return (
    <div className="card">
      <div className="card-h"><h3>Messages</h3><span className="mono text-[11px] text-[var(--ops-muted)]">{messages.length} messages</span></div>
      <div className="pad">
        {messages.length === 0 ? (
          <div className="empty">No messages or notes yet.</div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <div key={m.id} className="flex gap-3 p-3 rounded-xl border border-[var(--ops-border)] bg-[var(--ops-bg)]/60">
                <div className="h-8 w-8 rounded-full bg-[var(--ops-primary)] text-white grid place-items-center text-xs shrink-0 font-medium">
                  {m.authorName.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-[var(--ops-text)]">{m.authorName}</span>
                    <span className="mono text-[11px] text-[var(--ops-muted)] shrink-0">{formatLagos(m.createdAt, "datetime")}</span>
                  </div>
                  <p className="text-sm text-[var(--ops-text)] mt-1 whitespace-pre-wrap break-words">{m.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {isLocked ? (
          <p className="mono text-[11px] text-[var(--ops-muted)] mt-4">Thread is locked for audit. Reopen to post again.</p>
        ) : (
          <div className="mt-4">
            <div className="fld">
              <label>Follow-up message (emailed to agent)</label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="e.g. Client called, wants to reschedule"
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="mono text-[11px] text-[var(--ops-muted)]">{messageText.length}/5000</span>
              <button onClick={sendMessage} disabled={!messageText.trim() || messageSending} className="btn pri sm">
                {messageSending ? "Sending…" : "Send message"}
              </button>
            </div>
            {messageError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">{messageError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
