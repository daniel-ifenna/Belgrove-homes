export const statusLabels: Record<string, string> = {
  new: "New",
  under_review: "Under Review",
  on_hold: "On Hold",
  approved: "Approved",
  rescheduled: "Rescheduled",
  active: "Active",
  closed: "Closed",
};

// Ledger-room pill palette — status is color signal, never plain text.
// Outline pills = provisional states; solid pills = decided states.
export const statusColors: Record<string, string> = {
  new: "bg-transparent text-[#6B6252] border border-[#D8CFC0]",
  under_review: "bg-transparent text-[#8B6B1F] border border-[#C89B3C]",
  on_hold: "bg-transparent text-[#6B6252] border border-[#D8CFC0]",
  approved: "bg-[#1F6B3E] text-white border border-[#1F6B3E]",
  rescheduled: "bg-transparent text-[#1E3A5F] border border-[#C7D2E0]",
  active: "bg-[#16281D] text-white border border-[#16281D]",
  closed: "bg-[#E4D8C1] text-[#6B6252] border border-[#E4D8C1]",
};

export const temperatureColors: Record<string, string> = {
  cold: "bg-transparent text-[#1E3A5F] border border-[#C7D2E0]",
  warm: "bg-[#C89B3C] text-white border border-[#C89B3C]",
  hot: "bg-[#A6402F] text-white border border-[#A6402F]",
};

export const allStatuses = [
  "new",
  "under_review",
  "on_hold",
  "approved",
  "rescheduled",
  "active",
  "closed",
] as const;

export const allTemperatures = ["cold", "warm", "hot"] as const;

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
