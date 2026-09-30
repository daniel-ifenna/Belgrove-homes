import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { enqueueEmail, scheduleInlineOutboxSend } from "@/lib/email/outbox";

// The inline outbox send runs after the response; allow headroom for the
// request's own DB work plus the post-response SMTP send (Hobby max: 300s).
export const maxDuration = 30;
import { logServerError } from "@/lib/paymentConfirmation";
import { receiptPdfAbsolute } from "@/lib/receipt-storage";
import { promises as fsp } from "node:fs";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const receipt = await prisma.receipt.findUnique({
    where: { id },
    select: { id: true, ref: true, recipientEmail: true, status: true, pdfPath: true },
  });
  if (!receipt) return NextResponse.json({ error: "Receipt not found" }, { status: 404 });

  // Reuse same ref, same receipt record — do not create new receipt number.
  // Delivery goes through the outbox (retries + backoff); the request never
  // blocks on SMTP. The worker reuses the stored PDF (regenerating when
  // missing), sends, and records the attempt + audit rows itself.
  // Modes: default resends via outbox (stored PDF reused when present).
  // { "regen": true } drops the cached file first so the worker rebuilds it
  // from the snapshot (e.g. stored file predates branding) before sending.
  const body = await request.json().catch(() => null);
  const regen = body?.regen === true;
  if (regen && receipt.pdfPath) {
    // Drop the cached file so the worker rebuilds it from the snapshot.
    await fsp.unlink(receiptPdfAbsolute(receipt.pdfPath)).catch(() => null);
  }

  let outboxId: string;
  try {
    // Explicit user action: force bypasses dedupe so a resend always sends.
    outboxId = (
      await enqueueEmail(prisma, {
        type: "receipt",
        to: receipt.recipientEmail,
        payload: { receiptId: receipt.id },
        relatedType: "receipt",
        relatedId: receipt.id,
        force: true,
      })
    ).id;
  } catch (e) {
    logServerError(`receipt ${receipt.ref}: resend enqueue failed`, e);
    return NextResponse.json({ error: "Couldn't queue the resend. Please try again." }, { status: 500 });
  }
  await prisma.auditEvent.create({
    data: {
      actorId: session!.user.id,
      actorName: session!.user.name ?? session!.user.email ?? "Unknown",
      action: regen ? "receipt.regen_resend" : "receipt.resend",
      entityType: "receipt",
      entityId: receipt.id,
      before: Prisma.JsonNull,
      after: { queued: true, regenerated: regen, to: receipt.recipientEmail },
    },
  });
  scheduleInlineOutboxSend([outboxId]);

  return NextResponse.json({ queued: true, regenerated: regen, receipt }, { status: 202 });
}
