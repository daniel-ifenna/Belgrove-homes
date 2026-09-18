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
  new: "bg-[#E8EEF0] text-[#1E3A5F] border border-[#C7D2E0]",
  under_review: "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]",
  on_hold: "bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]",
  approved: "bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]",
  rescheduled: "bg-[#F5F0FF] text-[#5B21B6] border border-[#DDD6FE]",
  active: "bg-[#E0F2F1] text-[#0D3328] border border-[#B2DFDB]",
  closed: "bg-[#1A1A1A] text-white border border-[#1A1A1A]",
};

export const temperatureColors: Record<string, string> = {
  cold: "bg-[#F1F3F2] text-[#4B5563] border border-[#E3E6E1]",
  warm: "bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]",
  hot: "bg-[#FEF2F2] text-[#9F1239] border border-[#FECACA]",
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
