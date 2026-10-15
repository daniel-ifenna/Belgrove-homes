import { describe, it, expect, beforeAll } from "vitest";

// Live-DB test for the total-balance gate's atomicity: two concurrent confirms
// that each fit alone but together exceed the balance — only one is accepted.
// Uses isTest=true rows (excluded from every metric/queue) and removes them
// afterwards. Skipped when the database is unreachable.

let dbUp = false;
let prismaMod: typeof import("@/lib/prisma") | null = null;

beforeAll(async () => {
  try {
    prismaMod = await import("@/lib/prisma");
    await prismaMod.prisma.$queryRawUnsafe("SELECT 1");
    dbUp = true;
  } catch {
    dbUp = false;
  }
});

const maybe = (name: string, fn: () => Promise<void>) =>
  it(name, async () => {
    if (!dbUp || !prismaMod) return;
    await fn();
  });

describe("total-balance gate concurrency (live DB)", () => {
  maybe("two concurrent over-total confirms: exactly one accepted, ledger reconciles", async () => {
    const { prisma } = prismaMod!;
    const { applyConfirmationDbUnit, TotalBalanceExceededError } = await import("../paymentConfirmation");
    const { verifyTransactionLedger } = await import("../finance/ledger");

    const plan = await prisma.paymentPlan.findFirst({ where: { isActive: true } });
    if (!plan) return; // no plan to attach the test transaction to
    const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

    const txn = await prisma.transaction.create({
      data: {
        ref: `TXN-GATE-${stamp}`,
        customerName: "Gate Test",
        customerEmail: `gate-${stamp}@example.com`,
        estate: "Gate Estate",
        plotQuantity: 1,
        unitPrice: 1_000_000,
        baseAmount: 1_000_000,
        paymentPlanId: plan.id,
        interestRate: plan.interestRate,
        interestMethod: plan.interestMethod,
        interestAmount: 0,
        totalPayable: 1_000_000,
        totalPaid: 0,
        outstandingBalance: 1_000_000,
        status: "ACTIVE",
        isTest: true,
      },
    });
    const mkPay = (tag: string) =>
      prisma.payment.create({
        data: {
          transactionId: txn.id,
          installmentId: null,
          paymentReference: `PAY-GATE-${stamp}-${tag}`,
          amount: 600_000,
          paymentDate: new Date(),
          paymentMethod: "Bank Transfer",
          status: "PENDING_VERIFICATION",
          source: "MANUAL",
          idempotencyKey: `gate-${stamp}-${tag}`,
        },
      });
    try {
      await prisma.installment.createMany({
        data: [
          { transactionId: txn.id, installmentNumber: 0, type: "INITIAL", dueDate: new Date(), scheduledAmount: 600_000, paidAmount: 0, status: "DUE" },
          { transactionId: txn.id, installmentNumber: 1, type: "MONTHLY", dueDate: new Date(), scheduledAmount: 400_000, paidAmount: 0, status: "PENDING" },
        ],
      });
      const [p1, p2] = await Promise.all([mkPay("a"), mkPay("b")]);
      const confirm = (pId: string, tag: string) =>
        prisma.$transaction(
          (tx) =>
            applyConfirmationDbUnit(tx, {
              paymentId: pId,
              transactionId: txn.id,
              receiptRef: `BEL-GATE-${stamp}-${tag}`,
              receiptUrl: `https://example.com/r/gate-${stamp}-${tag}`,
              qrTargetUrl: `https://example.com/r/gate-${stamp}-${tag}`,
              pdfPath: null,
              accessToken: `gate-token-${stamp}-${tag}`,
            }),
          { maxWait: 8000, timeout: 15000 }
        );
      const [r1, r2] = await Promise.allSettled([confirm(p1.id, "a"), confirm(p2.id, "b")]);
      const ok = [r1, r2].filter((r) => r.status === "fulfilled");
      const bad = [r1, r2].filter((r) => r.status === "rejected");
      expect(ok).toHaveLength(1);
      expect(bad).toHaveLength(1);
      expect((bad[0] as PromiseRejectedResult).reason).toBeInstanceOf(TotalBalanceExceededError);

      const check = await verifyTransactionLedger(prisma, txn.id);
      expect(check.problems).toEqual([]);
      const live = await prisma.transaction.findUniqueOrThrow({ where: { id: txn.id } });
      expect(live.totalPaid).toBe(600_000);
      expect(live.outstandingBalance).toBe(400_000);
    } finally {
      const payIds = (
        await prisma.payment.findMany({ where: { transactionId: txn.id }, select: { id: true } })
      ).map((p) => p.id);
      if (payIds.length > 0) {
        await prisma.auditEvent.deleteMany({ where: { entityId: { in: payIds } } });
      }
      await prisma.transaction.delete({ where: { id: txn.id } });
    }
  });
});
