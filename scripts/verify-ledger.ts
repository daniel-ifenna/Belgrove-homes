// Read-only ledger verification: compares ledger-derived balances against
// legacy stored columns for every transaction and prints a comparison table.
// Exit 1 on any mismatch. Safe to run against any database (never writes).
//
// Usage: DATABASE_URL="..." npx tsx scripts/verify-ledger.ts
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { verifyTransactionLedger } from "../src/lib/finance/ledger.js";

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

async function main() {
  const txns = await prisma.transaction.findMany({
    select: { id: true, ref: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`${txns.length} transactions`);
  let bad = 0;
  for (const t of txns) {
    const check = await verifyTransactionLedger(prisma, t.id);
    const mark = check.ok ? "OK  " : "FAIL";
    if (!check.ok) bad++;
    console.log(
      `  ${mark} ${t.ref}: ledger paid ${naira(check.ledger.totalPaid)} / out ${naira(check.ledger.outstanding)} ` +
        `vs stored paid ${naira(check.stored.totalPaid)} / out ${naira(check.stored.outstanding)}` +
        (check.ok ? "" : ` :: ${check.problems.join("; ")}`)
    );
  }
  console.log(bad === 0 ? "All agree." : `${bad} mismatched.`);
  if (bad > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
