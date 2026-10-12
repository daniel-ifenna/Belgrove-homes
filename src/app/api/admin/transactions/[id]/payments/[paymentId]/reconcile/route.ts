import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { toUserFacingError, logServerError } from "@/lib/paymentConfirmation";

// Bank-reconciliation tick: an admin confirms a payment against a bank
// statement line. Appends to the verification note (never overwrites) with
// who and when, plus an audit entry. Applies to any non-voided payment.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string; paymentId: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, paymentId } = await ctx.params;
  const body = await request.json().catch(() => null);
  const bankLine = typeof body?.bankLine === "string" ? body.bankLine.trim().slice(0, 200) : "";
  if (!bankLine) return NextResponse.json({ error: "Bank statement line reference is required" }, { status: 400 });

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.transactionId !== id) {
    return NextResponse.json({ error: "Payment not found for this transaction." }, { status: 404 });
  }
  if (payment.status !== "CONFIRMED" && payment.status !== "PENDING_VERIFICATION") {
    return NextResponse.json({ error: "Only live payments can be reconciled." }, { status: 409 });
  }

  const actorName = session!.user.name ?? session!.user.email ?? "Unknown";
  const tick = `Reconciled: bank line ${bankLine} by ${actorName} at ${new Date().toISOString()}`;
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.payment.update({
        where: { id: payment.id },
        data: { verificationNote: [payment.verificationNote, tick].filter(Boolean).join(" | ") },
      });
      await tx.auditEvent.create({
        data: {
          actorId: session!.user.id,
          actorName,
          action: "payment.reconcile",
          entityType: "payment",
          entityId: payment.id,
          before: { verificationNote: payment.verificationNote ?? null },
          after: { verificationNote: row.verificationNote, bankLine },
        },
      });
      return row;
    });
    return NextResponse.json({ payment: { id: updated.id, verificationNote: updated.verificationNote } });
  } catch (e) {
    logServerError(`reconcile payment ${paymentId}`, e);
    return NextResponse.json({ error: toUserFacingError(e, "save") }, { status: 500 });
  }
}
