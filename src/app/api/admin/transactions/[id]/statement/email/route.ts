import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { generateStatementPdf, type StatementEntry } from "@/lib/statement";
import { formatDisplayName } from "@/lib/formatName";
import { logServerError } from "@/lib/paymentConfirmation";

export const maxDuration = 60;

// Email the Statement of Account PDF to the client (direct Resend send, no
// queue). Fresh idempotency key per click; a timeout retry reuses the key the
// 503 response hands back — same contract as the receipt resend.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const txn = await prisma.transaction.findUnique({
    where: { id },
    include: {
      booking: { select: { ref: true } },
      ledgerEntries: {
        orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }],
        include: { payment: { select: { paymentReference: true } } },
      },
    },
  });
  if (!txn) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const key =
    typeof body?.idempotencyKey === "string" && body.idempotencyKey.length >= 8
      ? body.idempotencyKey.slice(0, 120)
      : `statement:${txn.id}:${randomUUID()}`;

  const receipts = await prisma.receipt.findMany({
    where: { transactionId: id },
    select: { paymentId: true, ref: true },
  });
  const refByPayment = new Map(receipts.map((r) => [r.paymentId as string, r.ref]));
  const entries: StatementEntry[] = txn.ledgerEntries.map((e) => ({
    id: e.id,
    type: e.type,
    amount: e.amount,
    direction: e.direction,
    effectiveDate: e.effectiveDate,
    createdAt: e.createdAt,
    method: e.method,
    bankReference: e.bankReference,
    paymentReference: e.payment?.paymentReference ?? null,
    receiptRef: e.paymentId ? (refByPayment.get(e.paymentId) ?? null) : null,
    note: e.note,
  }));
  let pdf: Buffer;
  try {
    pdf = generateStatementPdf({
      transactionRef: txn.ref,
      bookingRef: txn.booking?.ref ?? null,
      clientName: formatDisplayName(txn.customerName),
      clientPhone: txn.customerPhone ?? "",
      clientEmail: txn.customerEmail,
      propertyLine: `${txn.estate}${txn.unitType ? ` · ${txn.unitType}` : ""}${txn.plotCode ? ` · ${txn.plotCode}` : ""}`,
      entries,
      generatedAt: new Date(),
    });
  } catch (e) {
    logServerError(`statement ${id}: PDF build failed`, e);
    return NextResponse.json({ error: "Couldn't build the statement right now. Please try again." }, { status: 502 });
  }

  const { sendEmail } = await import("@/lib/email/sendEmail");
  let result: { sent: boolean; error: string | null };
  try {
    result = await sendEmail({
      to: txn.customerEmail,
      subject: `Your Belgrove statement of account ${txn.ref}`,
      html:
        `<p>Hi ${formatDisplayName(txn.customerName)},</p>` +
        `<p>Your statement of account for <strong>${txn.ref}</strong> is attached as PDF. ` +
        `It lists every charge and payment with a running balance.</p>` +
        `<p>Thank you. It is a pleasure doing business with you.</p>`,
      attachments: [{ filename: `Belgrove-Statement-${txn.ref}.pdf`, content: pdf, contentType: "application/pdf" }],
      idempotencyKey: key,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Email failed";
    logServerError(`statement ${id}: email threw`, e);
    result = { sent: false, error: msg };
  }

  if (result.sent) {
    await prisma.auditEvent.create({
      data: {
        actorId: session!.user.id,
        actorName: session!.user.name ?? session!.user.email ?? "Unknown",
        action: "statement.email",
        entityType: "transaction",
        entityId: txn.id,
        before: { emailed: false },
        after: { sent: true, to: txn.customerEmail },
      },
    });
    return NextResponse.json({ sent: true, to: txn.customerEmail });
  }
  if (result.error && /timed out/i.test(result.error)) {
    return NextResponse.json(
      { error: "The send timed out and may have delivered. Check Resend before retrying.", idempotencyKey: key, retryable: true },
      { status: 503 }
    );
  }
  return NextResponse.json({ error: result.error ?? "Email failed" }, { status: 502 });
}
