"use client";
/* eslint-disable react-hooks/set-state-in-effect -- intentional prop->state sync after refresh */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AgentNameCell({
  bookingId,
  initialValue,
  updatedAt,
}: {
  bookingId: string;
  initialValue: string | null;
  updatedAt: Date;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep displayed value in sync when parent refreshes with new booking data
  // (e.g. another admin saved). Don't clobber an in-progress edit.
  useEffect(() => {
    if (!editing) setValue(initialValue ?? "");
  }, [initialValue, editing]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          agentName: value,
          expectedUpdatedAt: updatedAt.toISOString(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Couldn't save try again.");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Couldn't save try again.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="border border-stone-300 rounded px-2 py-1 text-xs w-28"
        />
        <button
          onClick={save}
          disabled={saving}
          className="text-xs text-emerald-700 hover:underline"
        >
          Save
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setError(null);
            setValue(initialValue ?? "");
          }}
          className="text-xs text-stone-400 hover:underline"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-red-600 ml-1">{error}</span>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`text-xs ${initialValue ? "text-stone-700" : "text-red-500 italic"} hover:underline`}
    >
      {initialValue || "Add agent"}
    </button>
  );
}
