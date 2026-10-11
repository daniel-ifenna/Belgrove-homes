// Backfills LedgerEntry + PaymentAllocation rows for pre-ledger history.
//
// Usage: npx tsx scripts/backfill-ledger.ts [--apply]
// Default is --dry-run: prints what would be written plus the projected
// comparison table, changing nothing. --apply writes (idempotent: reruns
// skip on the unique idempotencyKey / paymentId constraints).
//
// Per transaction (oldest first):
//   CHARGE_BASE (+ CHARGE_INTEREST when > 0), effectiveDate = createdAt.
//   CONFIRMED payments in createdAt order: PAYMENT entry (effectiveDate =
//   paymentDate, so backdates land correctly) + waterfall allocations replayed
//   against a running paid-amount map (same planner the live code uses).
//   CANCELLED payments that were once confirmed get a REVERSAL entry — the
//   script aborts on any it cannot explain (receipt exists but no entry, or
//   allocation replay diverges from stored paidAmount).
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import {
  postLedgerEntry,
  planAllocation,
  verifyTransactionLedger,
} from "../src/lib/finance/ledger.js";

const APPLY = process.argv.includes("--apply");

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

async function main() {
  const transactions = await prisma.transaction.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      installments: { orderBy: { installmentNumber: "asc" } },
      payments: { orderBy: { createdAt: "asc" } },
    },
  });
  console.log(`[dry-run=${!APPLY}] ${transactions.length} transactions`);

  let wroteEntries = 0;
  let wroteAllocs = 0;
  let mismatches = 0;

  for (const t of transactions) {
    // --- charges (idempotent keys) ---
    const chargeOps: { type: "CHARGE_BASE" | "CHARGE_INTEREST"; amount: number; key: string; note: string }[] = [
      { type: "CHARGE_BASE", amount: t.baseAmount, key: `charge:${t.id}:base`, note: "Base price at transaction creation (backfill)" },
    ];
    if (t.interestAmount > 0) {
      chargeOps.push({
        type: "CHARGE_INTEREST",
        amount: t.interestAmount,
        key: `charge:${t.id}:interest`,
        note: "One-time interest at transaction creation (backfill)",
      });
    }

    // --- payments + replayed allocations ---
    const paidMap = new Map<string, number>(t.installments.map((i) => [i.id, 0]));
    const paymentOps: {
      payment: (typeof t.payments)[number];
      allocs: { installmentId: string; amount: number }[];
      voided: boolean;
      voidedAt?: Date;
    }[] = [];
    for (const p of t.payments) {
      if (p.status === "CONFIRMED") {
        // Credit payments allocate only the schedulable portion (the live
        // confirm capped them); the remainder is the recorded creditAmount.
        const allocatable = p.isCredit ? p.amount - (p.creditAmount ?? 0) : p.amount;
        const allocs = planAllocation(
          t.installments.map((i) => ({
            id: i.id,
            installmentNumber: i.installmentNumber,
            scheduledAmount: i.scheduledAmount,
            paidAmount: paidMap.get(i.id) ?? 0,
          })),
          p.installmentId,
          allocatable
        );
        for (const a of allocs) paidMap.set(a.installmentId, (paidMap.get(a.installmentId) ?? 0) + a.amount);
        paymentOps.push({ payment: p, allocs, voided: false });
      } else if (p.status === "CANCELLED") {
        // Voided under old code: no live attribution (skip replay), but the
        // money history needs a PAYMENT + REVERSAL pair so totals net to zero
        // and the audit trail survives. Void time comes from the audit log.
        const receipt = await prisma.receipt.findUnique({ where: { paymentId: p.id }, select: { id: true } });
        if (!receipt) continue; // never touched totals — no entry needed
        const voidAudit = await prisma.auditEvent.findFirst({
          where: { entityType: "payment", entityId: p.id, action: "payment.void" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });
        paymentOps.push({ payment: p, allocs: [], voided: true, voidedAt: voidAudit?.createdAt ?? p.updatedAt });
      }
    }

    // --- replay must reproduce stored paidAmount exactly ---
    for (const i of t.installments) {
      const replayed = paidMap.get(i.id) ?? 0;
      if (replayed !== i.paidAmount) {
        throw new Error(
          `${t.ref}: replay diverges on installment #${i.installmentNumber} (replayed ${replayed} != stored ${i.paidAmount})`
        );
      }
    }

    if (!APPLY) {
      const payTotal = paymentOps.reduce((s, o) => s + o.payment.amount, 0);
      console.log(
        `  WOULD ${t.ref}: ${chargeOps.length} charges (${chargeOps.map((c) => naira(c.amount)).join(" + ")}) + ` +
          `${paymentOps.length} payments (${naira(payTotal)}) + ` +
          `${paymentOps.reduce((s, o) => s + o.allocs.length, 0)} allocations`
      );
      continue;
    }

    for (const c of chargeOps) {
      try {
        await postLedgerEntry(prisma, {
          transactionId: t.id,
          type: c.type,
          amount: c.amount,
          direction: "DEBIT",
          effectiveDate: t.createdAt,
          note: c.note,
          idempotencyKey: c.key,
        });
        wroteEntries++;
      } catch (e: unknown) {
        if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002") continue; // rerun
        throw e;
      }
    }
    for (const { payment: p, allocs, voided, voidedAt } of paymentOps) {
      // Rerun-safe: P2002 on either write falls through to lookup + skip.
      let entryId: string | null = null;
      try {
        const entry = await postLedgerEntry(prisma, {
          transactionId: t.id,
          type: "PAYMENT",
          amount: p.amount,
          direction: "CREDIT",
          effectiveDate: p.paymentDate,
          paymentId: p.id,
          method: p.paymentMethod,
          bankReference: p.bankReference,
          recordedById: p.recordedById,
          note: "Confirmed payment (backfill)",
          idempotencyKey: `payment:${p.id}`,
        });
        entryId = entry.id;
        wroteEntries++;
      } catch (e: unknown) {
        if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002") {
          entryId = (await prisma.ledgerEntry.findUnique({ where: { paymentId: p.id }, select: { id: true } }))?.id ?? null;
        } else throw e;
      }
      if (voided && entryId) {
        try {
          await postLedgerEntry(prisma, {
            transactionId: t.id,
            type: "REVERSAL",
            amount: p.amount,
            direction: "DEBIT",
            effectiveDate: voidedAt ?? p.updatedAt,
            reversesEntryId: entryId,
            note: "Void of confirmed payment (backfill)",
            idempotencyKey: `reversal:${p.id}`,
          });
          wroteEntries++;
        } catch (e: unknown) {
          if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002") continue; // rerun
          throw e;
        }
      }
      for (const a of allocs) {
        try {
          await prisma.paymentAllocation.create({
            data: { paymentId: p.id, installmentId: a.installmentId, amount: a.amount },
          });
          wroteAllocs++;
        } catch (e: unknown) {
          if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002") continue; // rerun
          throw e;
        }
      }
    }

    // --- verify immediately after writing ---
    const check = await verifyTransactionLedger(prisma, t.id);
    const mark = check.ok ? "OK  " : "FAIL";
    if (!check.ok) mismatches++;
    console.log(
      `  ${mark} ${t.ref}: ledger paid ${naira(check.ledger.totalPaid)} / out ${naira(check.ledger.outstanding)} ` +
        `vs stored paid ${naira(check.stored.totalPaid)} / out ${naira(check.stored.outstanding)}` +
        (check.ok ? "" : ` :: ${check.problems.join("; ")}`)
    );
  }

  if (APPLY) console.log(`Wrote ${wroteEntries} entries + ${wroteAllocs} allocations, ${mismatches} mismatched.`);
  else console.log("Dry run complete — re-run with --apply to write.");
  if (mismatches > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
