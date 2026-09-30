// Backfills receipt plotQuantity/unitPrice snapshots from each receipt's
// linked transaction. Receipts confirmed before the snapshot columns were
// populated render PDFs without the Plot Qty row — this restores them so
// every receipt (and its regenerations) shows "Plots: N × SQMsqm".
//
// Usage: npx tsx scripts/backfill-receipt-plot-qty.ts [--apply]
// Default is --dry-run: prints what would change, changes nothing.
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

const APPLY = process.argv.includes("--apply");

async function main() {
  const receipts = await prisma.receipt.findMany({
    where: { OR: [{ plotQuantity: null }, { unitPrice: null }] },
    select: {
      id: true, ref: true, plotQuantity: true, unitPrice: true,
      transaction: { select: { id: true, ref: true, plotQuantity: true, unitPrice: true } },
    },
    orderBy: { ref: "asc" },
  });

  const fixable = receipts.filter((r) => r.transaction);
  const orphaned = receipts.filter((r) => !r.transaction);

  console.log(`[dry-run=${!APPLY}] ${receipts.length} receipts missing plot snapshot`);
  for (const r of fixable) {
    console.log(
      `  FILL ${r.ref}: plotQuantity=${r.plotQuantity ?? "null"} -> ${r.transaction!.plotQuantity}, ` +
      `unitPrice=${r.unitPrice ?? "null"} -> ${r.transaction!.unitPrice} (from txn ${r.transaction!.ref})`
    );
  }
  for (const r of orphaned) {
    console.log(`  SKIP ${r.ref}: no linked transaction — left for a human`);
  }

  if (!APPLY) {
    console.log(`Dry run complete — ${fixable.length} would update. Re-run with --apply.`);
    return;
  }

  for (const r of fixable) {
    await prisma.receipt.update({
      where: { id: r.id },
      data: {
        ...(r.plotQuantity == null ? { plotQuantity: r.transaction!.plotQuantity } : {}),
        ...(r.unitPrice == null ? { unitPrice: r.transaction!.unitPrice } : {}),
      },
    });
  }
  console.log(`Applied: ${fixable.length} receipts updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
