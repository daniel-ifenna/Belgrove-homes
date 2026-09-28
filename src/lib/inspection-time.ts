// Scheduled inspection start = (rescheduledDate ?? preferredDate) at
// (rescheduledTime ?? preferredTime). Times look like "10:00 AM".
export function parseSlotMinutes(slot: string | null | undefined): number | null {
  if (!slot) return null;
  const m = slot.trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (/PM/i.test(m[3])) h += 12;
  return h * 60 + Number(m[2]);
}

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
  const mins = parseSlotMinutes(booking.rescheduledTime ?? booking.preferredTime);
  if (mins === null) {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  return d;
}
