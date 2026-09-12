export const statusLabels: Record<string, string> = {
  new: "New",
  under_review: "Under Review",
  on_hold: "On Hold",
  approved: "Approved",
  rescheduled: "Rescheduled",
  active: "Active",
  closed: "Closed",
};

export const statusColors: Record<string, string> = {
  new: "bg-[var(--blue-600)] text-white",
  under_review: "bg-[var(--amber-600)] text-white",
  on_hold: "bg-[#C07A2A] text-white",
  approved: "bg-[var(--forest-600)] text-white",
  rescheduled: "bg-[var(--plum-600)] text-white",
  active: "bg-[var(--forest-800)] text-white",
  closed: "bg-[var(--ink)] text-white",
};

export const temperatureColors: Record<string, string> = {
  cold: "bg-[var(--blue-600)] text-white",
  warm: "bg-[var(--amber-600)] text-white",
  hot: "bg-[var(--red-600)] text-white",
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
