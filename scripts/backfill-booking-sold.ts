// Backfills booking outcome -> "sold" for bookings that already have a
// linked transaction (the auto-flip in createTransactionFromBooking only
// covers new transactions).
//
// Usage: npx tsx scripts/backfill-booking-sold.ts [--apply]
// Default is --dry-run: prints what would change, changes nothing.
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

const APPLY = process.argv.includes("--apply");

async function main() {
  // Bookings with a linked transaction whose outcome was never flipped.
  const candidates = await prisma.inspectionBooking.findMany({
    where: { transaction: { isNot: null } },
    select: {
      id: true, ref: true, status: true, outcome: true,
      transaction: { select: { id: true, ref: true, status: true } },
    },
    orderBy: { ref: "asc" },
  });

  const flippable = candidates.filter((b) => b.outcome === "interested" || b.outcome === null);
  const needsReview = candidates.filter((b) => b.outcome !== "interested" && b.outcome !== null && b.outcome !== "sold");

  console.log(`[dry-run=${!APPLY}] ${candidates.length} bookings with a linked transaction`);
  for (const b of flippable) {
    console.log(`  FLIP ${b.ref}: outcome=${b.outcome ?? "null"} -> sold (txn ${b.transaction!.ref}, txn status ${b.transaction!.status})`);
  }
  for (const b of needsReview) {
    console.log(`  REVIEW ${b.ref}: outcome=${b.outcome} with live txn ${b.transaction!.ref} — left for a human`);
  }

  if (!APPLY) {
    console.log(`Dry run complete — ${flippable.length} would flip. Re-run with --apply.`);
    return;
  }

  for (const b of flippable) {
    await prisma.$transaction(async (tx) => {
      await tx.inspectionBooking.update({ where: { id: b.id }, data: { outcome: "sold" } });
      await tx.bookingActivity.create({
        data: {
          bookingId: b.id,
          actorId: null,
          actorName: "Backfill",
          action: "record_outcome",
          fromStatus: b.status,
          toStatus: b.status,
          note: "Backfill: marked Sold — linked transaction already exists",
        },
      });
    });
  }
  console.log(`Applied: ${flippable.length} bookings marked sold.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
