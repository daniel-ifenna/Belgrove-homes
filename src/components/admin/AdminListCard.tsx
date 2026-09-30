import Link from "next/link";
import type { ReactNode } from "react";

// Shared mobile list card for admin list pages (bookings, transactions,
// receipts). Single column on narrow screens: ref + badges on one wrapping
// row, name and email each on their own line, then label/value rows stacked.
// The detail grid uses auto-fit minmax so two columns appear only when each
// is at least 140px wide — otherwise everything stacks and labels can never
// sit side by side and overlap. Every text holder is min-w-0 + break-words
// (overflow-wrap: anywhere); never break-all, which shreds words into
// character-per-line wrapping when the container is narrow. Desktop tables
// are untouched — this renders only below lg (callers wrap it in lg:hidden).
export type AdminCardRow = {
  label: string;
  value: ReactNode;
};

export default function AdminListCard({
  href,
  refText,
  name,
  email,
  badges,
  rows,
  refNoWrap = false,
}: {
  href: string;
  refText: string;
  name: string;
  email?: string | null;
  badges: ReactNode;
  rows: AdminCardRow[];
  // References (BEL-2026-XXXXX) must never break mid-string.
  refNoWrap?: boolean;
}) {
  return (
    <Link
      href={href}
      className="block min-w-0 bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-4 shadow-[var(--ops-shadow-sm)] hover:shadow-[var(--ops-shadow-md)] transition-shadow overflow-hidden"
    >
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 min-w-0">
            <span className={`font-mono text-[12px] font-medium text-[var(--ops-primary)] min-w-0 ${refNoWrap ? "whitespace-nowrap" : "break-words"}`}>
              {refText}
            </span>
            <span className="flex flex-wrap items-center gap-1.5 min-w-0">{badges}</span>
          </div>
          <div className="text-[14px] font-medium text-[var(--ops-text)] mt-1.5 break-words min-w-0">
            {name}
          </div>
          {email ? (
            <div className="text-[12px] text-[var(--ops-muted)] break-words min-w-0">{email}</div>
          ) : null}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(140px,100%),1fr))] gap-3 text-xs min-w-0">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <div className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">
              {row.label}
            </div>
            <div className="mt-0.5 min-w-0 break-words text-[13px] text-[var(--ops-text)]">
              {row.value}
            </div>
          </div>
        ))}
      </div>
    </Link>
  );
}
