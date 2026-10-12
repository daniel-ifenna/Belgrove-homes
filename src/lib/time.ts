// Business timezone helpers (single place, client-safe, Intl-only).
// Every "today", "overdue", "before schedule" and month-boundary computation
// runs in BUSINESS_TIMEZONE (Africa/Lagos) — never the server timezone.
// Lagos has no DST, but offsets are resolved via Intl so the code stays
// correct under any TZ env (tests run under UTC and America/Los_Angeles).

export const BUSINESS_TIMEZONE = process.env.BUSINESS_TIMEZONE || "Africa/Lagos";

// UTC offset of the business zone at a given instant, in minutes.
export function zoneOffsetMinutes(instant: Date, zone: string = BUSINESS_TIMEZONE): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) parts[p.type] = p.value;
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return Math.round((asUTC - instant.getTime()) / 60000);
}

function parseTimeSlot(slot: string | null | undefined): { h: number; m: number } | null {
  if (!slot) return null;
  const m = slot.trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (/PM/i.test(m[3])) h += 12;
  return { h, m: Number(m[2]) };
}

/** "10:00 AM" → minutes since midnight (Lagos wall time has no DST shifts). */
export function parseSlotMinutes(slot: string | null | undefined): number | null {
  const t = parseTimeSlot(slot);
  return t ? t.h * 60 + t.m : null;
}

// "2026-09-30" (+ optional "12:00 PM") interpreted as a Lagos local wall time
// → UTC instant. Date-only input means Lagos midnight.
export function lagosToUtc(dateStr: string, timeStr?: string | null, zone: string = BUSINESS_TIMEZONE): Date {
  const dm = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dm) throw new Error(`Invalid date: ${dateStr}`);
  const y = Number(dm[1]);
  const mo = Number(dm[2]);
  const d = Number(dm[3]);
  const t = parseTimeSlot(timeStr) ?? { h: 0, m: 0 };
  // Fixed-point iteration: guess UTC, measure zone offset there, correct.
  let guess = Date.UTC(y, mo - 1, d, t.h, t.m, 0, 0);
  for (let i = 0; i < 2; i++) guess = Date.UTC(y, mo - 1, d, t.h, t.m, 0, 0) - zoneOffsetMinutes(new Date(guess), zone) * 60000;
  return new Date(guess);
}

// Lagos calendar day key "YYYY-MM-DD" for day-precision comparisons.
export function lagosDayKey(d: Date | string, zone: string = BUSINESS_TIMEZONE): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(dt);
}

// Start of the current Lagos day as a UTC instant.
export function startOfTodayLagos(now: Date = new Date(), zone: string = BUSINESS_TIMEZONE): Date {
  return lagosToUtc(lagosDayKey(now, zone), null, zone);
}

// Today's Lagos date as an <input type="date"> value.
export function lagosTodayInput(now: Date = new Date(), zone: string = BUSINESS_TIMEZONE): string {
  return lagosDayKey(now, zone);
}

// Lagos month window [start, end) as UTC instants.
export function lagosMonthRange(month: Date = new Date(), zone: string = BUSINESS_TIMEZONE): { start: Date; end: Date } {
  const dt = month instanceof Date ? month : new Date(month);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit" }).formatToParts(dt);
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const mo = Number(parts.find((p) => p.type === "month")!.value);
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = lagosToUtc(`${y}-${pad(mo)}-01`, null, zone);
  const endMo = mo === 12 ? 1 : mo + 1;
  const endY = mo === 12 ? y + 1 : y;
  const end = lagosToUtc(`${endY}-${pad(endMo)}-01`, null, zone);
  return { start, end };
}

export function formatLagos(d: Date | string, style: "date" | "datetime" = "date", zone: string = BUSINESS_TIMEZONE): string {  const dt = typeof d === "string" ? new Date(d) : d;
  if (style === "datetime") {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dt);
  }
  return new Intl.DateTimeFormat("en-GB", { timeZone: zone, day: "2-digit", month: "short", year: "numeric" }).format(dt);
}

// Canonical payment/document date "dd-mm-yyyy" in an explicit zone (default
// business zone). THE only date formatter for money surfaces: Payment
// History, statements, receipts, ledger pages, dashboard figures. Never use
// getDate()/toLocaleDateString() (server-local zone) on these paths — that
// off-by-one is how 08-08 became 09-08 between panels.
export function formatDateDMY(d: Date | string, zone: string = BUSINESS_TIMEZONE): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(dt);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("day")}-${get("month")}-${get("year")}`;
}

// Payment effective dates are calendar dates, not instants. Callers holding a
// "YYYY-MM-DD" form value (or any Date) pass it here and store the result: a
// noon-UTC instant whose calendar date is stable under DATE *and* timestamp
// columns in every zone from UTC-12 to UTC+12. Midnight instants are banned —
// Lagos midnight is 23:00Z the previous day, which is exactly how one panel
// printed 08-08 while another printed 09-08.
export function toDateOnlyNoonUtc(input: Date | string): Date {
  if (typeof input === "string") {
    const dm = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!dm) throw new Error(`Invalid date: ${input}`);
    return new Date(Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), 12, 0, 0, 0));
  }
  if (Number.isNaN(input.getTime())) throw new Error("Invalid date");
  // Date inputs mean "that day in Lagos" (e.g. a default of now at 23:30Z is
  // already tomorrow in Lagos) — derive the Lagos calendar day first.
  const [y, mo, d] = lagosDayKey(input).split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
}
