// Replaces cuid paymentReference values with PAY-YYYY-XXXXX refs.
// Existing rows keep working (unique either way); new rows require the
// generator (schema has no default so a missing call fails loudly).
//
// Usage: npx tsx scripts/backfill-payment-refs.ts [--apply]
// Default is --dry-run.
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { prefixedRef } from "../src/lib/ref.js";

const APPLY = process.argv.includes("--apply");

async function main() {
  const payments = await prisma.payment.findMany({
    select: { id: true, paymentReference: true, amount: true, transaction: { select: { ref: true } } },
    orderBy: { createdAt: "asc" },
  });
  const needs = payments.filter((p) => !p.paymentReference.startsWith("PAY-"));
  console.log(`[dry-run=${!APPLY}] ${payments.length} payments, ${needs.length} need PAY- refs`);
  const used = new Set(payments.map((p) => p.paymentReference));
  for (const p of needs) {
    let ref = prefixedRef("PAY");
    let guard = 0;
    while (used.has(ref) && guard++ < 10) ref = prefixedRef("PAY");
    console.log(`  PAYMENT ${p.id} (${p.transaction.ref} ₦${p.amount.toLocaleString("en-NG")}) ${p.paymentReference} → ${ref}`);
    if (APPLY) {
      await prisma.payment.update({ where: { id: p.id }, data: { paymentReference: ref } });
      used.add(ref);
    }
  }
  if (!APPLY) console.log("Dry run complete — re-run with --apply to write changes.");
  else console.log(`Applied: ${needs.length} payment refs rewritten.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
