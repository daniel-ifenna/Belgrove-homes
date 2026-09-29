// One-time workspace wipe (dev cleanup): deletes ALL business data —
// bookings, transactions (+installments/payments via cascade), receipts
// (+send attempts via cascade), customers, audit events, messages/notes
// (via booking cascade), notifications, activities, and ALL outbox rows.
// USERS ARE NEVER TOUCHED (login credentials preserved).
// Storage PDFs with no receipt row are removed from disk.
//
// Usage: npx tsx scripts/clear-dev-data.ts [--apply]
// Default is --dry-run: prints exactly what would change.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma.js";

const APPLY = process.argv.includes("--apply");

async function main() {
  const bookings = await prisma.inspectionBooking.findMany({
    select: { id: true, ref: true, name: true, isTest: true },
    orderBy: { ref: "asc" },
  });
  const transactions = await prisma.transaction.findMany({
    select: { id: true, ref: true, customerName: true },
    orderBy: { ref: "asc" },
  });
  const payments = await prisma.payment.findMany({ select: { id: true } });
  const receipts = await prisma.receipt.findMany({ select: { id: true, ref: true } });
  const customers = await prisma.customer.findMany({ select: { id: true, email: true } });
  const outbox = await prisma.emailOutbox.findMany({
    select: { id: true, type: true, status: true },
    orderBy: { createdAt: "asc" },
  });
  const audits = await prisma.auditEvent.findMany({ select: { id: true } });
  const notifications = await prisma.notification.findMany({ select: { id: true } });
  const activities = await prisma.bookingActivity.findMany({ select: { id: true } });
  const users = await prisma.user.findMany({ select: { email: true } });

  const receiptPaths = await prisma.receipt.findMany({ select: { pdfPath: true } });
  const referenced = new Set(receiptPaths.map((r) => r.pdfPath).filter((v): v is string => !!v));
  const storageDir = path.join(process.cwd(), "storage", "receipts");
  const orphanPdfs: string[] = [];
  if (fs.existsSync(storageDir)) {
    for (const f of fs.readdirSync(storageDir)) {
      const rel = `storage/receipts/${f}`;
      if (!referenced.has(rel)) orphanPdfs.push(rel);
    }
  }

  console.log(`[dry-run=${!APPLY}] bookings (ALL deleted): ${bookings.length}`);
  for (const b of bookings) console.log(`  BOOKING ${b.ref} (${b.name}) isTest=${b.isTest}`);
  console.log(`transactions (ALL deleted): ${transactions.length}`);
  for (const t of transactions) console.log(`  TRANSACTION ${t.ref} (${t.customerName})`);
  console.log(`payments (via cascade): ${payments.length}`);
  console.log(`receipts (ALL deleted): ${receipts.length}`);
  console.log(`customers (ALL deleted): ${customers.length}`);
  console.log(`outbox rows (ALL deleted): ${outbox.length}`);
  for (const o of outbox) console.log(`  OUTBOX ${o.type} [${o.status}]`);
  console.log(`audit events: ${audits.length}`);
  console.log(`notifications: ${notifications.length}`);
  console.log(`booking activities: ${activities.length}`);
  console.log(`orphan PDFs on disk (deleted): ${orphanPdfs.length}`);
  for (const f of orphanPdfs) console.log(`  PDF ${f}`);
  console.log(`users (NEVER touched): ${users.length}`);
  for (const u of users) console.log(`  USER ${u.email}`);

  if (!APPLY) {
    console.log("Dry run complete — re-run with --apply to delete.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    if (notifications.length) await tx.notification.deleteMany({ where: { id: { in: notifications.map((n) => n.id) } } });
    if (activities.length) await tx.bookingActivity.deleteMany({ where: { id: { in: activities.map((a) => a.id) } } });
    if (outbox.length) await tx.emailOutbox.deleteMany({ where: { id: { in: outbox.map((o) => o.id) } } });
    if (audits.length) await tx.auditEvent.deleteMany({ where: { id: { in: audits.map((a) => a.id) } } });
    if (receipts.length) await tx.receipt.deleteMany({ where: { id: { in: receipts.map((r) => r.id) } } });
    if (transactions.length) await tx.transaction.deleteMany({ where: { id: { in: transactions.map((t) => t.id) } } });
    if (bookings.length) await tx.inspectionBooking.deleteMany({ where: { id: { in: bookings.map((b) => b.id) } } });
    if (customers.length) await tx.customer.deleteMany({ where: { id: { in: customers.map((c) => c.id) } } });
  });
  for (const f of orphanPdfs) {
    try {
      fs.unlinkSync(path.join(process.cwd(), f));
    } catch {
      console.log(`  could not delete ${f}`);
    }
  }
  console.log("Wipe complete. Users untouched.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
