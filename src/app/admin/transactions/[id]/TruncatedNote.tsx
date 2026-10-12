"use client";
import { useState } from "react";

// Long free-text notes never dump into the list: two lines + expander.
export default function TruncatedNote({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (text.length <= 140) {
    return <span className="mono text-[11px] text-[var(--ops-muted)]"> · {text}</span>;
  }
  return (
    <span className="mono text-[11px] text-[var(--ops-muted)]">
      {" · "}
      <span className={open ? "" : "line-clamp-2"}>{text}</span>{" "}
      <button onClick={() => setOpen((o) => !o)} className="underline underline-offset-4 hover:text-[var(--ops-text)]">
        {open ? "Hide note" : "Show note"}
      </button>
    </span>
  );
}
