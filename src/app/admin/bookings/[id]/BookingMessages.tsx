"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Message = {
  id: string;
  authorName: string;
  message: string;
  createdAt: string | Date;
};

export default function BookingMessages({
  bookingId,
  initialMessages,
  isClosed,
}: {
  bookingId: string;
  initialMessages: Message[];
  isClosed: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
      setMessages((m) => [...m, data.message]);
      setText("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-stone-100 bg-gradient-to-r from-stone-50 to-white">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
            <span className="h-7 w-7 rounded-full bg-stone-800 text-white grid place-items-center text-xs">💬</span>
            Messaging System
            <span className="text-xs font-normal text-stone-500">· internal follow-up thread</span>
          </h2>
          <span className={`text-xs px-2 py-1 rounded-full ${isClosed ? "bg-stone-200 text-stone-600" : "bg-emerald-100 text-emerald-700"}`}>
            {isClosed ? "Closed read-only" : `${messages.length} messages`}
          </span>
        </div>
        <p className="text-xs text-stone-500 mt-2">
          {isClosed ? "Booking closed messaging is now read-only for audit. Review timeline below." : "Post updates, client contact notes, and follow-up reminders here. Thread persists until booking is closed."}
        </p>
      </div>

      <div className="px-6 py-4">
        {messages.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-stone-200 rounded-lg bg-stone-50/50">
            <p className="text-sm text-stone-500">No messages yet</p>
            <p className="text-xs text-stone-400 mt-1">Start the follow-up thread after assigning a company agent.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {messages.map((m) => (
              <div key={m.id} className="flex gap-3 p-3 rounded-lg border border-stone-100 bg-stone-50/40 hover:bg-stone-50 transition-colors">
                <div className="h-8 w-8 rounded-full bg-stone-800 text-white grid place-items-center text-xs shrink-0 font-medium">
                  {m.authorName.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-stone-800">{m.authorName}</span>
                    <span className="text-xs text-stone-400 shrink-0">
                      {new Date(m.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm text-stone-600 mt-1 whitespace-pre-wrap break-words">{m.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isClosed ? (
          <div className="mt-5">
            <label className="block text-xs font-medium text-stone-600 mb-2">New message</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Called client confirmed for Thu 10am, sent location pin. Next: dispatch agent Ada."
              rows={3}
              className="w-full border border-stone-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-stone-400">{text.length}/5000</span>
              <button
                onClick={send}
                disabled={!text.trim() || sending}
                className="text-sm bg-stone-800 text-white rounded-lg px-5 py-2.5 font-medium hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? "Sending…" : "Send message"}
              </button>
            </div>
            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          </div>
        ) : (
          <div className="mt-5 p-3 bg-stone-100 border border-stone-200 rounded-lg text-xs text-stone-500 text-center">
            🔒 Closed bookings are read-only. Outcome and timeline remain for audit.
          </div>
        )}
      </div>
    </div>
  );
}
