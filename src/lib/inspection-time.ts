import { lagosDayKey, lagosToUtc } from "./time";

/** @deprecated import from ./time instead. */
export { parseSlotMinutes } from "./time";

// Scheduled inspection start as a UTC instant: the Lagos calendar day of
// (rescheduledDate ?? preferredDate) at (rescheduledTime ?? preferredTime).
// Lagos-explicit — never server-local setHours (the old Sep-29-vs-Sep-30 bug).
export function scheduledInspectionStart(booking: {
  preferredDate: Date | string;
  preferredTime: string | null;
  rescheduledDate?: Date | string | null;
  rescheduledTime?: string | null;
}): Date | null {
  const day = booking.rescheduledDate ?? booking.preferredDate;
  if (!day) return null;
  const d = new Date(day);
  if (Number.isNaN(d.getTime())) return null;
  return lagosToUtc(lagosDayKey(d), booking.rescheduledTime ?? booking.preferredTime ?? null);
}
