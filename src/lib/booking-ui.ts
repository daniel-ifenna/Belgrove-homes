import { STATUS_STYLES, statusLabel } from "@/components/admin/StatusBadge";

// Back-compat re-exports — the canonical map lives in StatusBadge.tsx.
// Prefer <StatusBadge status={...} /> in new code.
export const statusLabels: Record<string, string> = {
  new: statusLabel("new"),
  under_review: statusLabel("under_review"),
  on_hold: statusLabel("on_hold"),
  approved: statusLabel("approved"),
  rescheduled: statusLabel("rescheduled"),
  active: statusLabel("active"),
  closed: statusLabel("closed"),
};

// Ledger-room pill palette — status is color signal, never plain text.
// Outline pills = provisional states; solid pills = decided states.
export const statusColors: Record<string, string> = {
  new: STATUS_STYLES.new,
  under_review: STATUS_STYLES.under_review,
  on_hold: STATUS_STYLES.on_hold,
  approved: STATUS_STYLES.approved,
  rescheduled: STATUS_STYLES.rescheduled,
  active: STATUS_STYLES.active,
  closed: STATUS_STYLES.closed,
};

export const temperatureColors: Record<string, string> = {
  cold: STATUS_STYLES.cold,
  warm: STATUS_STYLES.warm,
  hot: STATUS_STYLES.hot,
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

export const allOutcomes = ["sold", "interested", "not_sold"] as const;

// Date display goes through Lagos time (src/lib/time.ts) — never server-local.
import { formatLagos } from "@/lib/time";

export function formatDate(d: Date | string): string {
  return formatLagos(d, "date");
}

export function formatDateTime(d: Date | string): string {
  return formatLagos(d, "datetime");
}
