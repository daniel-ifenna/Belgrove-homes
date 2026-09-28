// Flags test/fixture rows so they never appear in metrics, queues or
// default list results (Option 1: ALL current rows are dev fixtures).
// Payments and receipts inherit test status through their transaction.
//
// Usage: npx tsx scripts/mark-test-data.ts [--apply]
// Default is --dry-run: prints exactly what would change.
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { customerShouldBeTest } from "../src/lib/customer.js";

const APPLY = process.argv.includes("--apply");

async function main() {
  const bookings = await prisma.inspectionBooking.findMany({
    where: { isTest: false },
    select: { ref: true, name: true },
    orderBy: { ref: "asc" },
  });
  const transactions = await prisma.transaction.findMany({
    where: { isTest: false },
    select: { ref: true, customerName: true },
    orderBy: { ref: "asc" },
  });
  console.log(`[dry-run=${!APPLY}] bookings to flag: ${bookings.length}`);
  for (const b of bookings) console.log(`  BOOKING ${b.ref} (${b.name}) → isTest=true`);
  console.log(`transactions to flag: ${transactions.length}`);
  for (const t of transactions) console.log(`  TRANSACTION ${t.ref} (${t.customerName}) → isTest=true`);

  const inheritingPayments = await prisma.payment.findMany({
    where: { transaction: { isTest: false } },
    select: { id: true, amount: true, transaction: { select: { ref: true } } },
  });
  console.log(`payments inheriting test status via transaction: ${inheritingPayments.length}`);
  for (const p of inheritingPayments) console.log(`  PAYMENT ${p.id} ₦${p.amount.toLocaleString("en-NG")} on ${p.transaction.ref}`);
  const receipts = await prisma.receipt.findMany({
    where: { transaction: { isTest: false } },
    select: { ref: true, finalAmount: true },
  });
  console.log(`receipts inheriting test status via transaction: ${receipts.length}`);
  for (const r of receipts) console.log(`  RECEIPT ${r.ref} ₦${r.finalAmount.toLocaleString("en-NG")}`);

  // Propagate to customers whose linked records are ALL test (unlinked or
  // mixed customers stay real).
  const customers = await prisma.customer.findMany({
    where: { isTest: false },
    select: {
      id: true,
      name: true,
      email: true,
      bookings: { select: { ref: true, isTest: true } },
      transactions: { select: { ref: true, isTest: true } },
    },
    orderBy: { email: "asc" },
  });
  const flaggable = customers.filter((c) =>
    customerShouldBeTest([...c.bookings.map((b) => b.isTest), ...c.transactions.map((t) => t.isTest)])
  );
  console.log(`customers to flag (all linked rows test): ${flaggable.length}`);
  for (const c of flaggable) {
    const refs = [...c.bookings.map((b) => b.ref), ...c.transactions.map((t) => t.ref)].join(", ");
    console.log(`  CUSTOMER ${c.name} <${c.email}> [${refs}] → isTest=true`);
  }
  const skipped = customers.length - flaggable.length;
  if (skipped > 0) console.log(`  (${skipped} customers left real: unlinked or mixed)`);

  if (APPLY) {
    const b = await prisma.inspectionBooking.updateMany({ where: { isTest: false }, data: { isTest: true } });
    const t = await prisma.transaction.updateMany({ where: { isTest: false }, data: { isTest: true } });
    const c = await prisma.customer.updateMany({ where: { id: { in: flaggable.map((x) => x.id) } }, data: { isTest: true } });
    console.log(`Applied: ${b.count} bookings, ${t.count} transactions, ${c.count} customers flagged isTest=true.`);
  } else {
    console.log("Dry run complete — re-run with --apply to write changes.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
