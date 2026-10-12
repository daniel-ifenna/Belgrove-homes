// Removes a client's full record chain (customer + bookings + transactions +
// payments + receipts + ledger rows) or, with --customer-only, just the
// Customer row (linked documents keep their name/email snapshots).
// With --transaction <ref> (repeatable), deletes only the listed transactions
// and their children — bookings and customers are never touched in this mode.
//
// Usage: npx tsx scripts/remove-client-chain.ts --customer <email> [--customer <email>...] [--transaction TXN-... [--transaction ...]] [--customer-only] [--reason "..."] [--actor "Name"] [--apply]
// Default is --dry-run: prints EXACTLY what would be deleted, changing nothing.
// --apply deletes inside one database transaction (DB work only).
//
// DANGER: this destroys audited financial history (confirmed payments, issued
// receipts, ledger entries). Already-emailed PDFs stay with the client —
// deletion removes system records only and cannot retract sent mail. AuditEvent
// rows have no foreign keys: they survive as orphans by design, plus explicit
// removal entries written here. There is no undo except a database restore.
// NEVER run from the dev machine against production; the owner applies this.
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const CUSTOMER_ONLY = args.includes("--customer-only");
const customers: string[] = [];
const txnRefs: string[] = [];
let reason = "manual removal requested by owner";
let actor = "Owner";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--customer" && args[i + 1]) customers.push(args[i + 1].toLowerCase());
  if (args[i] === "--transaction" && args[i + 1]) txnRefs.push(args[i + 1].toUpperCase());
  if (args[i] === "--reason" && args[i + 1]) reason = args[i + 1];
  if (args[i] === "--actor" && args[i + 1]) actor = args[i + 1];
}

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

async function main() {
  if (customers.length === 0 && txnRefs.length === 0) {
    console.error("Pass at least one --customer <email> or --transaction <ref>.");
    process.exitCode = 1;
    return;
  }
  console.log(`[dry-run=${!APPLY}] customerOnly=${CUSTOMER_ONLY}`);

  if (txnRefs.length > 0) {
    const txns = await prisma.transaction.findMany({
      where: { ref: { in: txnRefs } },
      select: { id: true, ref: true, status: true, totalPaid: true, outstandingBalance: true, isTest: true, bookingId: true, customerId: true },
    });
    const missing = txnRefs.filter((r) => !txns.some((t) => t.ref === r));
    for (const m of missing) console.log(`  ${m}: no Transaction row — skipped.`);
    const txnIds = txns.map((t) => t.id);
    if (txnIds.length > 0) {
      const [payments, receipts, ledger, statements, allocs, inst] = await Promise.all([
        prisma.payment.findMany({ where: { transactionId: { in: txnIds } }, select: { paymentReference: true, amount: true, status: true, paymentDate: true, transactionId: true } }),
        prisma.receipt.findMany({ where: { transactionId: { in: txnIds } }, select: { ref: true, finalAmount: true, sentAt: true, resendEmailId: true, transactionId: true } }),
        prisma.ledgerEntry.count({ where: { transactionId: { in: txnIds } } }),
        prisma.statement.findMany({ where: { transactionId: { in: txnIds } }, select: { number: true, transactionId: true } }),
        prisma.paymentAllocation.count({ where: { payment: { transactionId: { in: txnIds } } } }),
        prisma.installment.count({ where: { transactionId: { in: txnIds } } }),
      ]);
      for (const t of txns) {
        console.log(`  WOULD delete transaction ${t.ref} status=${t.status} paid=${naira(t.totalPaid)} outstanding=${naira(t.outstandingBalance)} isTest=${t.isTest}${t.bookingId ? ` bookingId=${t.bookingId} (booking kept)` : ""}`);
        for (const p of payments.filter((x) => x.transactionId === t.id)) {
          console.log(`    payment ${p.paymentReference} ${naira(p.amount)} status=${p.status} date=${p.paymentDate.toISOString().slice(0, 10)}`);
        }
        for (const r of receipts.filter((x) => x.transactionId === t.id)) {
          console.log(`    receipt ${r.ref} ${naira(r.finalAmount)} ${r.sentAt ? `EMAILED (proof ${r.resendEmailId ?? "sentAt only"}) — client keeps the PDF` : "not emailed"}`);
        }
        console.log(`    statements: ${statements.filter((s) => s.transactionId === t.id).map((s) => s.number).join(", ") || 0}`);
      }
      console.log(`  totals: ${inst} installments, ${payments.length} payments, ${receipts.length} receipts, ${ledger} ledger entries, ${allocs} allocations, ${statements.length} statements`);
      if (receipts.some((r) => r.sentAt)) console.log(`  WARNING: emailed receipt(s) cannot be retracted from clients.`);
      console.log(`  bookings and customers are NOT touched in transaction mode.`);

      if (APPLY) {
        await prisma.$transaction(async (tx) => {
          for (const t of txns) {
            await tx.auditEvent.create({
              data: { actorId: null, actorName: actor, action: "record.remove", entityType: "transaction", entityId: t.id, before: { ref: t.ref }, after: { ref: t.ref, reason } },
            });
          }
          const ids = (await tx.payment.findMany({ where: { transactionId: { in: txnIds } }, select: { id: true } })).map((p) => p.id);
          await tx.receipt.deleteMany({ where: { transactionId: { in: txnIds } } });
          await tx.paymentAllocation.deleteMany({ where: { paymentId: { in: ids } } });
          await tx.payment.deleteMany({ where: { id: { in: ids } } });
          await tx.installment.deleteMany({ where: { transactionId: { in: txnIds } } });
          await tx.ledgerEntry.deleteMany({ where: { transactionId: { in: txnIds } } });
          await tx.receipt.deleteMany({ where: { transactionId: { in: txnIds } } });
          await tx.statement.deleteMany({ where: { transactionId: { in: txnIds } } });
          await tx.transaction.deleteMany({ where: { id: { in: txnIds } } });
        });
        const left = await prisma.transaction.count({ where: { id: { in: txnIds } } });
        console.log(`  after: transactions=${left} (must be 0)`);
        if (left !== 0) process.exitCode = 1;
      }
    }
  }

  for (const email of customers) {
    const customer = await prisma.customer.findUnique({ where: { email } });
    if (!customer) {
      console.log(`  ${email}: no Customer row — skipped.`);
      continue;
    }
    console.log(`  Customer ${customer.name} <${customer.email}> id=${customer.id} isTest=${customer.isTest}`);
    const bookings = await prisma.inspectionBooking.findMany({
      where: { customerId: customer.id },
      select: { id: true, ref: true, status: true, outcome: true, isTest: true },
    });
    const txns = await prisma.transaction.findMany({
      where: { OR: [{ customerId: customer.id }, { bookingId: { in: bookings.map((b) => b.id) } }] },
      select: { id: true, ref: true, status: true, totalPaid: true, outstandingBalance: true, isTest: true },
    });
    const bookingIds = bookings.map((b) => b.id);
    const txnIds = txns.map((t) => t.id);
    const [activities, messages, notes, notifs, payments, receipts, ledger, statements, allocs] = await Promise.all([
      prisma.bookingActivity.count({ where: { bookingId: { in: bookingIds } } }),
      prisma.bookingMessage.count({ where: { bookingId: { in: bookingIds } } }),
      prisma.internalNote.count({ where: { bookingId: { in: bookingIds } } }),
      prisma.notification.count({ where: { bookingId: { in: bookingIds } } }),
      prisma.payment.findMany({ where: { transactionId: { in: txnIds } }, select: { paymentReference: true, amount: true, status: true } }),
      prisma.receipt.findMany({ where: { OR: [{ transactionId: { in: txnIds } }, { bookingId: { in: bookingIds } }] }, select: { ref: true, finalAmount: true, sentAt: true, resendEmailId: true } }),
      prisma.ledgerEntry.count({ where: { transactionId: { in: txnIds } } }),
      prisma.statement.findMany({ where: { transactionId: { in: txnIds } }, select: { number: true } }),
      txnIds.length > 0
        ? prisma.paymentAllocation.count({ where: { payment: { transactionId: { in: txnIds } } } })
        : 0,
    ]);

    for (const b of bookings) {
      console.log(`    WOULD delete booking ${b.ref} status=${b.status} outcome=${b.outcome} isTest=${b.isTest}`);
    }
    console.log(`    booking children: ${activities} activities, ${messages} messages, ${notes} notes, ${notifs} notifications`);
    for (const t of txns) {
      console.log(`    WOULD delete transaction ${t.ref} status=${t.status} paid=${naira(t.totalPaid)} outstanding=${naira(t.outstandingBalance)} isTest=${t.isTest}`);
    }
    for (const p of payments) {
      console.log(`      payment ${p.paymentReference} ${naira(p.amount)} status=${p.status}`);
    }
    for (const r of receipts) {
      console.log(`      receipt ${r.ref} ${naira(r.finalAmount)} ${r.sentAt ? `EMAILED (proof ${r.resendEmailId ?? "sentAt only"}) — client keeps the PDF` : "not emailed"}`);
    }
    console.log(`    ledger entries: ${ledger}, allocations: ${allocs}, statements: ${statements.map((s) => s.number).join(", ") || 0}`);
    const emailed = receipts.filter((r) => r.sentAt).length;
    if (emailed > 0) console.log(`    WARNING: ${emailed} receipt(s) already emailed — deletion cannot retract client-held PDFs.`);
    if (CUSTOMER_ONLY) {
      console.log(`    customer-only mode: documents above are NOT deleted; snapshots stay on them.`);
    }

    if (!APPLY) continue;

    await prisma.$transaction(async (tx) => {
      if (CUSTOMER_ONLY) {
        await tx.auditEvent.create({
          data: { actorId: null, actorName: actor, action: "record.remove", entityType: "customer", entityId: customer.id, before: { email }, after: { email, reason, note: "customer row only; linked documents kept" } },
        });
        await tx.customer.delete({ where: { id: customer.id } });
        return;
      }
      for (const ent of [
        ...bookings.map((b) => ({ type: "booking", id: b.id, ref: b.ref })),
        ...txns.map((t) => ({ type: "transaction", id: t.id, ref: t.ref })),
      ]) {
        await tx.auditEvent.create({
          data: { actorId: null, actorName: actor, action: "record.remove", entityType: ent.type, entityId: ent.id, before: { ref: ent.ref }, after: { ref: ent.ref, reason, customer: email } },
        });
      }
      await tx.auditEvent.create({
        data: { actorId: null, actorName: actor, action: "record.remove", entityType: "customer", entityId: customer.id, before: { email }, after: { email, reason } },
      });
      // Restrict-guarded children first, then everything else, roots last.
      // Receipts go before payments: Receipt.paymentId is a required column
      // with onDelete SetNull, so deleting a referenced payment fails with
      // P2011 — remove the receipts first instead.
      await tx.bookingActivity.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await tx.notification.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await tx.bookingMessage.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await tx.internalNote.deleteMany({ where: { bookingId: { in: bookingIds } } });
      await tx.receipt.deleteMany({ where: { OR: [{ transactionId: { in: txnIds } }, { bookingId: { in: bookingIds } }] } });
      const payIds = (await tx.payment.findMany({ where: { transactionId: { in: txnIds } }, select: { id: true } })).map((p) => p.id);
      await tx.paymentAllocation.deleteMany({ where: { paymentId: { in: payIds } } });
      await tx.payment.deleteMany({ where: { id: { in: payIds } } });
      await tx.installment.deleteMany({ where: { transactionId: { in: txnIds } } });
      await tx.ledgerEntry.deleteMany({ where: { transactionId: { in: txnIds } } });
      await tx.statement.deleteMany({ where: { transactionId: { in: txnIds } } });
      await tx.transaction.deleteMany({ where: { id: { in: txnIds } } });
      await tx.inspectionBooking.deleteMany({ where: { id: { in: bookingIds } } });
      await tx.customer.delete({ where: { id: customer.id } });
    });

    const left = await Promise.all([
      prisma.customer.count({ where: { id: customer.id } }),
      prisma.inspectionBooking.count({ where: { id: { in: bookingIds } } }),
      prisma.transaction.count({ where: { id: { in: txnIds } } }),
    ]);
    console.log(`    after: customer=${left[0]} bookings=${left[1]} transactions=${left[2]} (all must be 0)`);
    if (left.some((n) => n !== 0)) process.exitCode = 1;
  }
  console.log(APPLY ? "Apply complete." : "Dry run complete — re-run with --apply to delete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
