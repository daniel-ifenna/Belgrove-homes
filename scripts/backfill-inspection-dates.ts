// Normalizes inspection day fields to canonical form: a submitted
// YYYY-MM-DD means that calendar day in Lagos, stored as the UTC instant of
// Lagos midnight (e.g. "2026-09-30" → 2026-09-29T23:00:00Z). Legacy rows were
// stored as UTC midnight (new Date("YYYY-MM-DD")), which displays the same
// Lagos day but is a different instant — breaking exact time comparisons.
//
// Rows whose time part is exactly 00:00:00.000Z came from date-only inputs
// and are reinterpreted (UTC day-part → Lagos day). Any other time part is
// listed as NEEDS-REVIEW and left untouched.
//
// Usage: npx tsx scripts/backfill-inspection-dates.ts [--apply]
// Default is --dry-run.
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { lagosDayKey, lagosToUtc } from "../src/lib/time.js";

const APPLY = process.argv.includes("--apply");

function storedToCanonical(d: Date): { convert: boolean; next: Date | null; reason: string } {
  const iso = d.toISOString();
  if (iso.endsWith("T00:00:00.000Z")) {
    const dayPart = iso.slice(0, 10);
    return { convert: true, next: lagosToUtc(dayPart), reason: `reinterpret ${dayPart} as Lagos day` };
  }
  return { convert: false, next: null, reason: `non-midnight time ${iso} — NEEDS-REVIEW` };
}

async function main() {
  const rows = await prisma.inspectionBooking.findMany({
    select: { id: true, ref: true, preferredDate: true, rescheduledDate: true },
    orderBy: { ref: "asc" },
  });
  let convert = 0;
  let review = 0;
  for (const b of rows) {
    for (const field of ["preferredDate", "rescheduledDate"] as const) {
      const d = b[field];
      if (!d) continue;
      const r = storedToCanonical(d);
      if (r.convert) {
        convert++;
        const lagosBefore = lagosDayKey(d);
        const lagosAfter = lagosDayKey(r.next!);
        console.log(
          `  CONVERT ${b.ref}.${field}: ${d.toISOString()} → ${r.next!.toISOString()} (Lagos day ${lagosBefore} → ${lagosAfter})`
        );
        if (APPLY) await prisma.inspectionBooking.update({ where: { id: b.id }, data: { [field]: r.next! } });
      } else {
        review++;
        console.log(`  REVIEW ${b.ref}.${field}: ${r.reason}`);
      }
    }
  }
  console.log(`[dry-run=${!APPLY}] ${rows.length} bookings: ${convert} conversions, ${review} need review.`);
  if (!APPLY) console.log("Dry run complete — re-run with --apply to write changes.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
