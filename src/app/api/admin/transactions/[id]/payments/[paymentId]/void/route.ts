import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import {
  reverseConfirmedPaymentDbUnit,
  toUserFacingError,
  logServerError,
  PaymentAlreadyHandledError,
} from "@/lib/paymentConfirmation";

// Void a payment.
// - PENDING_VERIFICATION → CANCELLED. Totals untouched (pending never counts).
// - CONFIRMED → CANCELLED with atomic reversal: the confirmed amount is
//   subtracted back off its installment and totals are recomputed in the same
//   transaction. The receipt row stays in place as an audit trail but no
//   longer counts toward totals.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string; paymentId: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, paymentId } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" ? body.reason.slice(0, 500) : null;

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.transactionId !== id) {
    return NextResponse.json({ error: "Payment not found for this transaction." }, { status: 404 });
  }

  try {
    if (payment.status === "PENDING_VERIFICATION") {
      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "CANCELLED",
          verificationNotes: reason ? `Voided: ${reason}` : "Voided before verification",
          updatedAt: new Date(),
        },
      });
      return NextResponse.json({ payment: updated });
    }

    if (payment.status === "CONFIRMED") {
      const result = await prisma.$transaction(
        async (tx) => reverseConfirmedPaymentDbUnit(tx, { paymentId, transactionId: id, reason }),
        { maxWait: 5000, timeout: 10000 }
      );
      return NextResponse.json({
        payment: { id: paymentId, status: "CANCELLED" },
        newTotalPaid: result.newTotalPaid,
        newOutstanding: result.newOutstanding,
        note: "Confirmed payment voided and totals reversed. Its receipt remains on file for audit.",
      });
    }

    return NextResponse.json(
      { error: `Only pending or confirmed payments can be voided (status is ${payment.status}).` },
      { status: 409 }
    );
  } catch (e) {
    logServerError(`void payment ${paymentId}`, e);
    if (e instanceof PaymentAlreadyHandledError) {
      return NextResponse.json({ error: toUserFacingError(e, "void") }, { status: 409 });
    }
    return NextResponse.json({ error: toUserFacingError(e, "void") }, { status: 500 });
  }
}
