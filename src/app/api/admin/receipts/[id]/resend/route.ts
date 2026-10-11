import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { logServerError } from "@/lib/paymentConfirmation";
import { renderReceiptPdfBuffer } from "@/lib/receipt-render";
import { sendReceiptEmail } from "@/lib/receipts/emailReceipt";
import { persistReceiptEmailSent } from "@/lib/receiptDelivery";

// Manual receipt resend. Sends immediately through Resend (no queue) and
// records only the minimal proof: resendEmailId + sentAt.
//
// Idempotency contract:
// - Every user-initiated resend mints a FRESH key (`resend:{id}:{uuid}`) —
//   never reuse a key across different bodies (Resend 409s that).
// - If the send times out (unknown outcome: may have delivered), the response
//   is 503 with the SAME key so the client retries with key + identical body
//   (safe replay — Resend returns the original send instead of duplicating).
// - A 409 means the key was seen with a different body: surfaces as a
//   conflict, never silently marked sent or failed.
export const maxDuration = 60;

function isTimeoutMessage(msg: string | null): boolean {
  return !!msg && /timed out/i.test(msg);
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      payment: { include: { installment: true } },
      transaction: {
        select: {
          ref: true,
          totalPayable: true,
          booking: { select: { ref: true } },
          payments: { where: { status: "CONFIRMED" }, select: { amount: true } },
        },
      },
    },
  });
  if (!receipt) return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  if (!receipt.payment) return NextResponse.json({ error: "Receipt has no payment link" }, { status: 409 });

  const body = await request.json().catch(() => null);
  const regen = body?.regen === true;
  // Client retry of a timed-out send passes back the key it was given; a new
  // click mints a fresh one. One key, one body — always.
  const key =
    typeof body?.idempotencyKey === "string" && body.idempotencyKey.length >= 8
      ? body.idempotencyKey.slice(0, 120)
      : `resend:${receipt.id}:${randomUUID()}`;

  // Same stored bytes every send (render-once); only an explicit regen
  // rebuilds from the snapshot before sending.
  let pdfBuffer: Buffer | null = receipt.pdfData && !regen ? Buffer.from(receipt.pdfData) : null;
  if (!pdfBuffer) {
    try {
      pdfBuffer = await renderReceiptPdfBuffer(receipt.id, regen ? { force: true } : undefined);
      await prisma.receipt.update({
        where: { id: receipt.id },
        data: { pdfStatus: "GENERATED", pdfData: new Uint8Array(pdfBuffer) },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 500) : "PDF regenerate failed";
      logServerError(`receipt ${receipt.ref}: resend PDF rebuild failed`, e);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  const confirmedTotal = (receipt.transaction?.payments ?? []).reduce((s, p) => s + p.amount, 0);
  const isFinalPayment = !!receipt.transaction && confirmedTotal >= receipt.transaction.totalPayable;
  const { buildAccountRef } = await import("@/lib/receipt-amounts");
  const accountRef = receipt.transaction
    ? buildAccountRef(receipt.transaction.ref, receipt.transaction.booking?.ref ?? null)
    : null;
  let result: { sent: boolean; error: string | null; providerMessageId?: string | null };
  try {
    result = await sendReceiptEmail({
      to: receipt.recipientEmail,
      clientName: receipt.customerName,
      ref: receipt.ref,
      receiptUrl: receipt.receiptUrl,
      pdfBuffer,
      idempotencyKey: key,
      isFinalPayment,
      accountRef,
      plotsSummary:
        receipt.plotQuantity != null
          ? receipt.sqm
            ? `Plots: ${receipt.plotQuantity} × ${receipt.sqm}sqm`
            : `Plots: ${receipt.plotQuantity}`
          : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Email failed";
    logServerError(`receipt ${receipt.ref}: resend threw`, e);
    result = { sent: false, error: msg };
  }

  const actorName = session!.user.name ?? session!.user.email ?? "Unknown";
  if (result.sent) {
    await persistReceiptEmailSent({
      db: prisma,
      receiptId: receipt.id,
      ref: receipt.ref,
      resendEmailId: result.providerMessageId ?? null,
    });
    await prisma.auditEvent.create({
      data: {
        actorId: session!.user.id,
        actorName,
        action: regen ? "receipt.regen_resend" : "receipt.resend",
        entityType: "receipt",
        entityId: receipt.id,
        before: { emailed: true },
        after: { resent: true, regenerated: regen, to: receipt.recipientEmail, resendEmailId: result.providerMessageId ?? null },
      },
    });
    return NextResponse.json({
      resent: true,
      regenerated: regen,
      resendEmailId: result.providerMessageId ?? null,
      receipt: { id: receipt.id, ref: receipt.ref, recipientEmail: receipt.recipientEmail },
    });
  }

  // Unknown outcome (timeout): the first request may have delivered. Do NOT
  // mint a new key — hand this one back so the retry replays identically.
  if (isTimeoutMessage(result.error)) {
    return NextResponse.json(
      {
        error: "The send timed out and may have delivered. Check Resend before retrying; retrying reuses the same idempotency key.",
        idempotencyKey: key,
        retryable: true,
      },
      { status: 503 }
    );
  }
  if (result.error?.includes("409")) {
    return NextResponse.json(
      { error: "Resend already recorded this send key with different content. Check the Resend dashboard instead of resending." },
      { status: 409 }
    );
  }
  return NextResponse.json({ error: result.error ?? "Resend failed" }, { status: 502 });
}
