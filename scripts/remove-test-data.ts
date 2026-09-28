// Permanently deletes test/fixture rows (isTest) and their dependents.
// Anything NOT flagged isTest is never touched — the script aborts if a
// test row is linked to a real row, unless --force is passed.
//
// Usage: npx tsx scripts/remove-test-data.ts [--apply] [--force]
// Default is --dry-run: prints exactly what would change.
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");

async function main() {
  const bookings = await prisma.inspectionBooking.findMany({
    where: { isTest: true },
    select: { id: true, ref: true, name: true },
    orderBy: { ref: "asc" },
  });
  const transactions = await prisma.transaction.findMany({
    where: { isTest: true },
    select: { id: true, ref: true, customerName: true, bookingId: true },
    orderBy: { ref: "asc" },
  });
  const bookingIds = new Set(bookings.map((b) => b.id));
  const txnIds = new Set(transactions.map((t) => t.id));

  const payments = await prisma.payment.findMany({
    where: { transactionId: { in: [...txnIds] } },
    select: { id: true, paymentReference: true, amount: true },
  });
  const paymentIds = new Set(payments.map((p) => p.id));

  const receipts = await prisma.receipt.findMany({
    where: {
      OR: [
        { transactionId: { in: [...txnIds] } },
        { bookingId: { in: [...bookingIds] } },
        { paymentId: { in: [...paymentIds] } },
      ],
    },
    select: { id: true, ref: true, finalAmount: true },
  });
  const receiptIds = new Set(receipts.map((r) => r.id));

  const entityIds = [...bookingIds, ...txnIds, ...paymentIds, ...receiptIds];
  const outbox = await prisma.emailOutbox.findMany({
    where: { relatedId: { in: entityIds } },
    select: { id: true, type: true, status: true },
  });
  const audits = await prisma.auditEvent.findMany({
    where: { entityId: { in: entityIds } },
    select: { id: true },
  });
  const notifications = await prisma.notification.findMany({
    where: { bookingId: { in: [...bookingIds] } },
    select: { id: true },
  });
  // BookingActivity.booking has no onDelete (Restrict) — delete explicitly.
  // (Messages and internal notes cascade from the booking.)
  const activities = await prisma.bookingActivity.findMany({
    where: { bookingId: { in: [...bookingIds] } },
    select: { id: true },
  });

  // Cross-contamination guard: test rows linked to REAL rows.
  const realTxnOnTestBooking = await prisma.transaction.findMany({
    where: { isTest: false, bookingId: { in: [...bookingIds] } },
    select: { ref: true },
  });
  const realBookingOnTestTxn = await prisma.inspectionBooking.findMany({
    where: { isTest: false, id: { in: transactions.map((t) => t.bookingId).filter((v): v is string => !!v) } },
    select: { ref: true },
  });
  const contaminated = realTxnOnTestBooking.length > 0 || realBookingOnTestTxn.length > 0;

  // Customers: only isTest ones whose linked rows are ALL being deleted.
  const customers = await prisma.customer.findMany({
    where: { isTest: true },
    select: {
      id: true,
      email: true,
      bookings: { select: { id: true, ref: true } },
      transactions: { select: { id: true, ref: true } },
    },
    orderBy: { email: "asc" },
  });
  const deletableCustomers = customers.filter(
    (c) =>
      [...c.bookings, ...c.transactions].length > 0 &&
      [...c.bookings, ...c.transactions].every((r) => bookingIds.has(r.id) || txnIds.has(r.id))
  );
  const skippedCustomers = customers.length - deletableCustomers.length;

  console.log(`[dry-run=${!APPLY}] test bookings: ${bookings.length}`);
  for (const b of bookings) console.log(`  BOOKING ${b.ref} (${b.name})`);
  console.log(`test transactions: ${transactions.length}`);
  for (const t of transactions) console.log(`  TRANSACTION ${t.ref} (${t.customerName})`);
  console.log(`payments on test transactions: ${payments.length}`);
  console.log(`receipts linked to test rows: ${receipts.length}`);
  for (const r of receipts) console.log(`  RECEIPT ${r.ref} ₦${r.finalAmount.toLocaleString("en-NG")}`);
  console.log(`outbox rows for test entities: ${outbox.length}`);
  console.log(`audit events for test entities: ${audits.length}`);
  console.log(`notifications on test bookings: ${notifications.length}`);
  console.log(`booking activities on test bookings: ${activities.length}`);
  console.log(`test customers fully linked to test rows (deleted): ${deletableCustomers.length}`);
  for (const c of deletableCustomers) console.log(`  CUSTOMER ${c.email}`);
  if (skippedCustomers > 0) console.log(`test customers kept (linked to real rows or unlinked): ${skippedCustomers}`);
  if (contaminated) {
    console.log(`WARNING: test rows link to REAL rows — refusing without --force:`);
    for (const t of realTxnOnTestBooking) console.log(`  real transaction ${t.ref} on a test booking`);
    for (const b of realBookingOnTestTxn) console.log(`  real booking ${b.ref} on a test transaction`);
  }
  console.log(`users: never touched`);

  if (!APPLY) {
    console.log("Dry run complete — re-run with --apply to delete.");
    return;
  }
  if (contaminated && !FORCE) {
    console.log("Aborted: pass --force to delete despite real-row links.");
    process.exitCode = 1;
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (notifications.length) await tx.notification.deleteMany({ where: { id: { in: notifications.map((n) => n.id) } } });
    if (activities.length) await tx.bookingActivity.deleteMany({ where: { id: { in: activities.map((a) => a.id) } } });
    if (outbox.length) await tx.emailOutbox.deleteMany({ where: { id: { in: outbox.map((o) => o.id) } } });
    if (audits.length) await tx.auditEvent.deleteMany({ where: { id: { in: audits.map((a) => a.id) } } });
    if (receiptIds.size) await tx.receipt.deleteMany({ where: { id: { in: [...receiptIds] } } }); // cascades send attempts
    if (txnIds.size) await tx.transaction.deleteMany({ where: { id: { in: [...txnIds] } } }); // cascades installments + payments
    if (bookingIds.size) await tx.inspectionBooking.deleteMany({ where: { id: { in: [...bookingIds] } } }); // cascades messages/activities/notes
    if (deletableCustomers.length) await tx.customer.deleteMany({ where: { id: { in: deletableCustomers.map((c) => c.id) } } });
  });
  console.log(
    `Deleted ${bookings.length} bookings, ${transactions.length} transactions, ${payments.length} payments, ` +
      `${receipts.length} receipts, ${outbox.length} outbox rows, ${audits.length} audit events, ` +
      `${notifications.length} notifications, ${activities.length} booking activities, ${deletableCustomers.length} customers.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
