import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { createManualTransaction } from "@/lib/transactionService";
import { getTransactionOverviews } from "@/lib/finance";
import { formatLagos } from "@/lib/time";
import { logServerError } from "@/lib/paymentConfirmation";

// Sends are direct Resend calls (no queue); allow headroom for the request's
// own DB work plus bounded sends (Hobby max: 300s).
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const status = searchParams.get("status") ?? "";
  const plan = searchParams.get("plan") ?? "";
  const pageParam = Number(searchParams.get("page") || "1");
  const page = Number.isFinite(pageParam) ? Math.max(1, Math.floor(pageParam)) : 1;
  const PAGE_SIZE = 25;

  const VALID_STATUSES = ["DRAFT", "ACTIVE", "PAID_IN_FULL", "CANCELLED"] as const;
  const where: any = {};
  if (status) {
    if (!(VALID_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }
    where.status = status;
  }
  if (plan) where.paymentPlanId = plan;
  if (q) {
    where.OR = [
      { ref: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { customerEmail: { contains: q, mode: "insensitive" } },
      { estate: { contains: q, mode: "insensitive" } },
      { plotCode: { contains: q, mode: "insensitive" } },
    ];
  }

  const [transactions, total, plans] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { paymentPlan: true },
    }),
    prisma.transaction.count({ where }),
    prisma.paymentPlan.findMany({ where: { isActive: true } }),
  ]);

  // Overdue counts from the finance service (rule 3) — never inline filters.
  const overviews = await getTransactionOverviews(transactions.map((t) => t.id));
  const enriched = transactions.map((t) => {
    const ov = overviews.get(t.id);
    return { ...t, outstandingBalance: ov?.outstanding ?? t.totalPayable, overdueCount: ov?.overdueCount ?? 0 };
  });

  return NextResponse.json({ transactions: enriched, total, plans });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const {
    customerName,
    customerEmail,
    customerPhone,
    estate,
    plotCode,
    unitType,
    sqm,
    plotQuantity = 1,
    unitPrice,
    paymentPlanCode,
    bookingId,
    agentId,
    manualReason,
  } = body;

  if (!customerName?.trim() || !customerEmail?.trim() || !estate?.trim() || !unitPrice || !paymentPlanCode) {
    return NextResponse.json({ error: "Missing required fields: customerName, customerEmail, estate, unitPrice, paymentPlanCode" }, { status: 400 });
  }
  // Server-side rule: a transaction must have bookingId OR a non-empty manualReason.
  if (!bookingId && !manualReason?.trim()) {
    return NextResponse.json({ error: "A reason is required for transactions without a booking" }, { status: 400 });
  }

  const qty = Number(plotQuantity) || 1;
  const price = Number(unitPrice);
  // Money is integer naira — reject floats, not just non-numbers.
  if (!Number.isInteger(price) || price <= 0 || !Number.isInteger(qty) || qty < 1) {
    return NextResponse.json({ error: "Enter whole-naira unitPrice and plotQuantity" }, { status: 400 });
  }

  try {
    // Idempotent handoff: one booking links to at most one transaction.
    if (bookingId) {
      const existingTxn = await prisma.transaction.findUnique({ where: { bookingId } });
      if (existingTxn) return NextResponse.json({ transaction: existingTxn, alreadyExists: true });
    }
    let transaction;
    const actorName = session!.user.name ?? session!.user.email ?? "Unknown";
    if (bookingId) {
      const { createTransactionFromBooking } = await import("@/lib/transactionService");
      transaction = await createTransactionFromBooking(bookingId, paymentPlanCode, price, qty, agentId, session!.user.id, actorName);
    } else {
      transaction = await createManualTransaction({
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone?.trim() || null,
        estate: estate.trim(),
        plotCode: plotCode?.trim() || null,
        unitType: unitType?.trim() || null,
        sqm: sqm ? Number(sqm) : null,
        plotQuantity: qty,
        unitPrice: price,
        paymentPlanCode,
        agentId: agentId || null,
        createdById: session!.user.id,
        actorName,
        manualReason: manualReason.trim(),
      });
    }

    // Confirmation email (one per client per transaction). Sent directly —
    // email failure never fails creation, it is logged and the receipt page
    // offers a manual resend.
    let confirmationEmail: { sent: boolean; error: string | null } = { sent: false, error: null };
    try {
      const created = await prisma.transaction.findUnique({
        where: { id: transaction.id },
        include: { paymentPlan: true, installments: { orderBy: { installmentNumber: "asc" } } },
      });
      if (created) {
        // Schedule dates through the shared Lagos helper (explicit zone) so
        // the confirmation email agrees with every money surface.
        const fmtD = (d: Date | string) => formatLagos(d, "date");
        const initial = created.installments.find((i) => i.type === "INITIAL");
        const monthlies = created.installments.filter((i) => i.type === "MONTHLY");
        const bookingRef = bookingId
          ? (await prisma.inspectionBooking.findUnique({ where: { id: bookingId }, select: { ref: true } }))?.ref ?? null
          : null;
        const { sendTransactionConfirmation } = await import("@/lib/email/emailService");
        confirmationEmail = await sendTransactionConfirmation(
          created.customerEmail,
          {
            name: created.customerName,
            txnRef: created.ref,
            bookingRef,
            propertyLine: `${created.estate}${created.unitType ? ` · ${created.unitType}` : ""}${created.plotCode ? ` · ${created.plotCode}` : ""}`,
            planName: created.paymentPlan.name,
            planCode: created.paymentPlan.code,
            depositAmount: initial && created.paymentPlan.remainingInstallments > 0 ? initial.scheduledAmount : null,
            depositDueDate: fmtD(initial?.dueDate ?? created.createdAt),
            schedule: monthlies.map((m) => ({ label: `Month ${m.installmentNumber}`, dueDate: fmtD(m.dueDate), amount: m.scheduledAmount })),
            interestAmount: created.interestAmount,
            interestRate: Number(created.interestRate),
            totalPayable: created.totalPayable,
          },
          // Stable key per transaction: a retried create-with-same-booking
          // returns the existing transaction before this point, so one key
          // can never double-send.
          { idempotencyKey: `txn-confirm:${created.id}` }
        );
        if (!confirmationEmail.sent) {
          logServerError(`transaction ${created.ref}: confirmation email failed`, confirmationEmail.error);
        }
        if (bookingId) {
          const line = `Transaction ${created.ref} created (${created.paymentPlan.name} plan), confirmation email ${confirmationEmail.sent ? "sent" : `failed: ${confirmationEmail.error ?? "unknown"}`}.`;
          await prisma.bookingMessage.create({
            data: { bookingId, authorId: null, authorName: "System", message: line },
          });
          await prisma.internalNote.create({
            data: { bookingId, authorId: null, authorName: "System", body: `[Transaction] ${line}` },
          });
        }
      }
    } catch (e) {
      confirmationEmail = { sent: false, error: e instanceof Error ? e.message : "Confirmation email failed" };
    }
    if (body.initialPayment && body.initialPayment.amount) {
      const { recordPaymentAndGenerateReceipt } = await import("@/lib/paymentService");
      const { toDateOnlyNoonUtc } = await import("@/lib/time");
      let payDate: Date;
      try {
        payDate = body.initialPayment.paymentDate
          ? toDateOnlyNoonUtc(String(body.initialPayment.paymentDate))
          : toDateOnlyNoonUtc(new Date());
      } catch {
        return NextResponse.json({ error: "Invalid initial payment date" }, { status: 400 });
      }
      const payMethod = body.initialPayment.paymentMethod || "Bank Transfer";
      const payAmount = Number(body.initialPayment.amount);
      if (!Number.isInteger(payAmount) || payAmount <= 0) {
        return NextResponse.json({ error: "Enter a whole-naira initial payment amount" }, { status: 400 });
      }
      // Find initial installment
      const installments = await prisma.installment.findMany({ where: { transactionId: transaction.id }, orderBy: { installmentNumber: "asc" } });
      const initialInst = installments.find((i) => i.type === "INITIAL") ?? installments[0];
      try {
        const result = await recordPaymentAndGenerateReceipt({
          transactionId: transaction.id,
          installmentId: initialInst?.id ?? null,
          amount: payAmount,
          paymentDate: payDate,
          paymentMethod: payMethod,
          notes: body.initialPayment.notes ?? null,
          recordedById: session!.user.id,
          recordedByName: session!.user.name ?? session!.user.email ?? "Unknown",
        });
        return NextResponse.json({ transaction, payment: result.payment, receipt: result.receipt, confirmationEmail, receiptEmail: result.email }, { status: 201 });
      } catch (e) {
        const { toUserFacingError, logServerError, OverScheduleError, TotalBalanceExceededError } = await import("@/lib/paymentConfirmation");
        logServerError("initial payment failed", e);
        if (e instanceof OverScheduleError || e instanceof TotalBalanceExceededError) {
          return NextResponse.json({ error: toUserFacingError(e, "record") }, { status: 400 });
        }
        return NextResponse.json({ error: toUserFacingError(e, "record") }, { status: 500 });
      }
    }

    return NextResponse.json({ transaction, confirmationEmail }, { status: 201 });
  } catch (e: any) {
    const { toUserFacingError } = await import("@/lib/paymentConfirmation");
    console.error("Create transaction failed", e);
    return NextResponse.json({ error: toUserFacingError(e, "save") }, { status: 500 });
  }
}
