import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { logServerError } from "@/lib/paymentConfirmation";
import { enqueueEmail, findPendingReceiptOutboxRow, scheduleInlineOutboxSend } from "@/lib/email/outbox";

// The inline outbox send runs after the response; allow headroom for the
// request's own DB work plus the post-response send (Hobby max: 300s).
export const maxDuration = 60;

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const receipt = await prisma.receipt.findUnique({
    where: { id },
    select: { id: true, ref: true, recipientEmail: true, status: true },
  });
  if (!receipt) return NextResponse.json({ error: "Receipt not found" }, { status: 404 });

  // Reuse same ref, same receipt record — do not create new receipt number.
  // Delivery goes through the outbox (retries + backoff); the request never
  // blocks on the provider. Sends reuse the stored PDF bytes generated once
  // at confirmation; only { regen: true } ("Regenerate & resend") rebuilds
  // the PDF from the snapshot before sending.
  const body = await request.json().catch(() => null);
  const regen = body?.regen === true;

  let outboxId: string;
  let deduped = false;
  // Cooldown: a queued or in-flight row for this receipt means a send is
  // already on its way — reuse it instead of queueing a duplicate. This is
  // what stops rapid repeat clicks from piling up attempts on one receipt.
  // A regen resend always queues fresh so the rebuild isn't swallowed.
  const inFlight = regen
    ? null
    : await findPendingReceiptOutboxRow(prisma, receipt.id).catch((e) => {
        logServerError(`receipt ${receipt.ref}: pending-row lookup failed`, e);
        return null;
      });
  if (inFlight) {
    outboxId = inFlight.id;
    deduped = true;
  } else {
    try {
      // Explicit user action: force bypasses dedupe so a resend always sends.
      // regen:true rebuilds the stored PDF first (the only path that ever
      // regenerates); otherwise the send reuses the stored bytes.
      outboxId = (
        await enqueueEmail(prisma, {
          type: "receipt",
          to: receipt.recipientEmail,
          payload: regen ? { receiptId: receipt.id, regen: true } : { receiptId: receipt.id },
          relatedType: "receipt",
          relatedId: receipt.id,
          force: true,
        })
      ).id;
    } catch (e) {
      logServerError(`receipt ${receipt.ref}: resend enqueue failed`, e);
      return NextResponse.json({ error: "Couldn't queue the resend. Please try again." }, { status: 500 });
    }
  }
  await prisma.auditEvent.create({
    data: {
      actorId: session!.user.id,
      actorName: session!.user.name ?? session!.user.email ?? "Unknown",
      action: regen ? "receipt.regen_resend" : "receipt.resend",
      entityType: "receipt",
      entityId: receipt.id,
      before: Prisma.JsonNull,
      after: { queued: true, deduped, regenerated: regen, to: receipt.recipientEmail },
    },
  });
  scheduleInlineOutboxSend([outboxId]);

  return NextResponse.json({ queued: true, deduped, regenerated: regen, receipt }, { status: 202 });
}
