import type { BookingStatus, LeadTemperature } from "@/generated/prisma/client";

export type BookingAction =
  | "approve"
  | "reschedule"
  | "hold"
  | "under_review"
  | "mark_active"
  | "record_outcome"
  | "save"
  | "escalate_lead"
  | "assign_agent"
  | "reopen"
  | "cool_down"
  | "confirm_agent"
  | "add_note";

type StatusGatedAction = Exclude<BookingAction, "save" | "escalate_lead" | "assign_agent" | "add_note" | "confirm_agent">;

export const ALLOWED_FROM: Record<StatusGatedAction, BookingStatus[]> = {
  approve: ["new", "under_review", "on_hold", "approved", "rescheduled"],
  reschedule: ["new", "under_review", "on_hold", "approved", "rescheduled"],
  hold: ["new", "under_review", "approved", "rescheduled"],
  under_review: ["new", "on_hold", "approved", "rescheduled"],
  mark_active: ["approved", "rescheduled"],
  record_outcome: ["active"],
  reopen: ["closed"],
  cool_down: ["new", "under_review", "on_hold", "approved", "rescheduled", "active"],
};

export function isTransitionAllowed(action: BookingAction, status: BookingStatus): boolean {
  if (action === "save" || action === "escalate_lead" || action === "assign_agent" || action === "add_note" || action === "confirm_agent") return true;
  const allowed = ALLOWED_FROM[action as StatusGatedAction];
  return allowed ? allowed.includes(status) : false;
}

export const actionLabels: Record<BookingAction, string> = {
  approve: "Approve",
  reschedule: "Reschedule",
  hold: "Put on hold",
  under_review: "Mark under review",
  mark_active: "Mark as active",
  record_outcome: "Record outcome",
  save: "Edit fields",
  escalate_lead: "Escalate lead",
  assign_agent: "Assign agent",
  reopen: "Reopen booking",
  cool_down: "Cool down",
  confirm_agent: "Confirm match",
  add_note: "Add note",
};

export const temperatureRank: Record<LeadTemperature, number> = {
  cold: 0,
  warm: 1,
  hot: 2,
};

export function isEscalation(from: LeadTemperature, to: LeadTemperature): boolean {
  return temperatureRank[to] > temperatureRank[from];
}
export function isCoolDown(from: LeadTemperature, to: LeadTemperature): boolean {
  return temperatureRank[to] < temperatureRank[from];
}
