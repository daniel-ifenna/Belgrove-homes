import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { generateUniquePaymentRef } from "@/lib/ref";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { installmentId, amount, paymentDate, paymentMethod, bankReference, notes } = body;
  // Money is integer naira (schema Int) — reject floats, not just non-numbers.
  const amt = Number(amount);
  if (!Number.isInteger(amt) || amt <= 0) return NextResponse.json({ error: "Enter a whole-naira amount" }, { status: 400 });

  const date = paymentDate ? new Date(paymentDate) : new Date();
  if (Number.isNaN(date.getTime())) return NextResponse.json({ error: "Invalid payment date" }, { status: 400 });

  // Create payment as PENDING_VERIFICATION — does NOT affect totals until confirmed
  try {
    const transaction = await prisma.transaction.findUnique({ where: { id }, include: { installments: true } });
    if (!transaction) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    if (transaction.status === "CANCELLED") return NextResponse.json({ error: "Transaction is cancelled" }, { status: 400 });
    if (amt > transaction.outstandingBalance) return NextResponse.json({ error: `Amount exceeds outstanding balance of ${transaction.outstandingBalance}` }, { status: 400 });

    let installmentIdToUse = installmentId || null;
    if (!installmentIdToUse) {
      const next = transaction.installments.find((i: any) => i.status !== "PAID" && i.status !== "WAIVED");
      if (next) installmentIdToUse = next.id;
    }

    // Scheduled-amount guard: pending + confirmed money already on the
    // installment plus this amount must not exceed what the schedule says.
    // This is what stops several identical pending payments over-crediting
    // one installment — each extra submission is rejected with a clear error.
    if (installmentIdToUse) {
      const target = transaction.installments.find((i: any) => i.id === installmentIdToUse);
      if (target) {
        const pendingSum = await prisma.payment.aggregate({
          where: { transactionId: id, installmentId: installmentIdToUse, status: "PENDING_VERIFICATION" },
          _sum: { amount: true },
        });
        const { wouldExceedSchedule } = await import("@/lib/paymentConfirmation");
        if (
          wouldExceedSchedule(target.paidAmount ?? 0, pendingSum._sum.amount ?? 0, amt, target.scheduledAmount)
        ) {
          const recorded = (target.paidAmount ?? 0) + (pendingSum._sum.amount ?? 0);
          return NextResponse.json(
            {
              error:
                `This would exceed the installment's scheduled amount of ₦${target.scheduledAmount.toLocaleString("en-NG")} ` +
                `(₦${recorded.toLocaleString("en-NG")} already recorded or pending). Record one installment at a time.`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Duplicate-submission guard (§3.3): an identical *pending* payment
    // recorded in the last 60s (double-click / retry) returns the existing
    // row instead of minting a second one. Confirmed payments are never
    // deduped — each confirmation is a deliberate, audited act.
    const recentDup = await prisma.payment.findFirst({
      where: {
        transactionId: id,
        installmentId: installmentIdToUse,
        amount: amt,
        paymentMethod: paymentMethod || "Bank Transfer",
        status: "PENDING_VERIFICATION",
        createdAt: { gte: new Date(Date.now() - 60_000) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (recentDup) return NextResponse.json({ payment: recentDup, deduped: true });

    // Minted before the transaction so the DB callback holds no extra queries.
    const paymentReference = await generateUniquePaymentRef();
    const { payment } = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          transactionId: id,
          installmentId: installmentIdToUse,
          paymentReference,
          amount: amt,
          paymentDate: date,
          paymentMethod: paymentMethod || "Bank Transfer",
          bankReference: bankReference || null,
          notes: notes || null,
          status: "PENDING_VERIFICATION",
          recordedById: session!.user.id,
          source: "MANUAL",
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId: session!.user.id,
          actorName: session!.user.name ?? session!.user.email ?? "Unknown",
          action: "payment.record",
          entityType: "payment",
          entityId: created.id,
          before: Prisma.JsonNull,
          after: { status: "PENDING_VERIFICATION", amount: amt, paymentReference: created.paymentReference },
        },
      });
      return { payment: created };
    });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (e: any) {
    const { toUserFacingError, logServerError } = await import("@/lib/paymentConfirmation");
    logServerError("record payment", e);
    return NextResponse.json({ error: toUserFacingError(e, "record") }, { status: 500 });
  }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      installments: { orderBy: { installmentNumber: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
      receipts: { orderBy: { issuedAt: "desc" }, include: { sendAttempts: true } },
      paymentPlan: true,
    },
  });
  if (!transaction) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  return NextResponse.json({ transaction });
}
