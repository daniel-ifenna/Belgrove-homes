// Proposes booking↔transaction links: same customer (email) + same unit
// (estate + plotCode), booking sold, transaction unlinked. Linking is
// manual: --apply only links the pairs passed via --ids "bookingId:transactionId,...".
//
// Usage: npx tsx scripts/link-transactions-to-bookings.ts [--apply --ids b1:t1,b2:t2]
// Default is --dry-run: prints every proposal. Nothing is written without
// --apply --ids.
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { normalizeEmail } from "../src/lib/phone.js";

const APPLY = process.argv.includes("--apply");
const idsArg = process.argv.find((a) => a.startsWith("--ids="))?.slice("--ids=".length) ?? "";

async function main() {
  const bookings = await prisma.inspectionBooking.findMany({
    where: { outcome: "sold", transaction: null },
    select: { id: true, ref: true, name: true, email: true, estate: true, plotCode: true, unitType: true },
  });
  const transactions = await prisma.transaction.findMany({
    where: { bookingId: null },
    select: { id: true, ref: true, customerName: true, customerEmail: true, estate: true, plotCode: true, unitType: true },
  });

  const proposals: { booking: (typeof bookings)[number]; txn: (typeof transactions)[number] }[] = [];
  for (const b of bookings) {
    const bEmail = normalizeEmail(b.email);
    for (const t of transactions) {
      if (normalizeEmail(t.customerEmail) !== bEmail) continue;
      const sameEstate = (b.estate ?? "").trim().toLowerCase() === (t.estate ?? "").trim().toLowerCase();
      const samePlot = (b.plotCode ?? "").trim().toLowerCase() === (t.plotCode ?? "").trim().toLowerCase();
      if (sameEstate && (samePlot || (!b.plotCode && !t.plotCode))) proposals.push({ booking: b, txn: t });
    }
  }

  console.log(`[dry-run=${!APPLY}] ${bookings.length} sold unlinked bookings × ${transactions.length} unlinked transactions → ${proposals.length} proposals`);
  for (const p of proposals) {
    console.log(
      `  PROPOSE booking ${p.booking.ref} (${p.booking.name} · ${p.booking.estate ?? "?"} · ${p.booking.plotCode ?? "?"}) ↔ txn ${p.txn.ref} (${p.txn.customerName} · ${p.txn.estate} · ${p.txn.plotCode ?? "?"})  --ids=${p.booking.id}:${p.txn.id}`
    );
  }

  if (APPLY) {
    if (!idsArg) {
      console.error("--apply requires --ids bookingId:transactionId,... — nothing linked.");
      process.exit(1);
    }
    for (const pair of idsArg.split(",").map((s) => s.trim()).filter(Boolean)) {
      const [bookingId, transactionId] = pair.split(":");
      if (!bookingId || !transactionId) {
        console.error(`  SKIP malformed pair: ${pair}`);
        continue;
      }
      const already = await prisma.transaction.findUnique({ where: { id: transactionId }, select: { bookingId: true, ref: true } });
      if (!already) {
        console.error(`  SKIP ${pair}: transaction not found`);
        continue;
      }
      if (already.bookingId && already.bookingId !== bookingId) {
        console.error(`  SKIP ${pair}: transaction ${already.ref} already linked elsewhere`);
        continue;
      }
      await prisma.transaction.update({ where: { id: transactionId }, data: { bookingId } });
      console.log(`  LINKED transaction ${already.ref} → booking ${bookingId}`);
    }
  } else {
    console.log("Dry run complete — re-run with --apply --ids to link.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
