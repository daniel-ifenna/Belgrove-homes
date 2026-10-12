import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { issueStatement, statementVerifyUrl, StatementDataError } from "@/lib/statements";
import { formatDisplayName } from "@/lib/formatName";
import { formatNaira } from "@/lib/currency";
import { logServerError } from "@/lib/paymentConfirmation";

export const maxDuration = 60;

// Correction email: ONE system-drafted email carrying every replacement
// receipt plus the corrected statement, sent ONLY when an admin clicks send
// (confirm:true required). Nothing in the codebase calls this except the
// Corrections dialog — no correction, void, confirmation, generation,
// reconciliation, retry, webhook, import or backfill path sends it.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  if (!body || body.confirm !== true) {
    return NextResponse.json({ error: "Explicit confirmation is required (confirm:true)." }, { status: 400 });
  }
  const to = typeof body.to === "string" ? body.to.trim() : "";
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({ error: "A valid recipient email is required." }, { status: 400 });
  }
  const extraNote = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";
  const key =
    typeof body.idempotencyKey === "string" && body.idempotencyKey.length >= 8
      ? body.idempotencyKey.slice(0, 120)
      : `correction-email:${id}:${randomUUID()}`;

  const txn = await prisma.transaction.findUnique({
    where: { id },
    include: { booking: { select: { ref: true } } },
  });
  if (!txn) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  // Replacement receipts not yet emailed (voided originals stay silent).
  const replacements = await prisma.receipt.findMany({
    where: {
      transactionId: id,
      sentAt: null,
      payment: { correctsPaymentId: { not: null } },
    },
    select: { id: true, ref: true, pdfData: true },
  });
  if (replacements.some((r) => !r.pdfData)) {
    return NextResponse.json({ error: "A replacement PDF is missing. Regenerate it from its receipt page first." }, { status: 409 });
  }

  // Corrected statement for the current ledger (issues one if the ledger
  // changed since the latest; never emails on its own).
  let statement: { id: string };
  try {
    ({ statement } = await issueStatement(prisma as never, {
      transactionId: id,
      actorId: session!.user.id,
      actorName: session!.user.name ?? session!.user.email ?? "Unknown",
    }));
  } catch (e) {
    if (e instanceof StatementDataError) {
      return NextResponse.json(
        { error: "The statement data check failed — fix the ledger before emailing corrections.", problems: e.problems },
        { status: 409 }
      );
    }
    throw e;
  }
  const stmtRow = await prisma.statement.findUnique({ where: { id: statement.id } });
  if (!stmtRow) return NextResponse.json({ error: "Statement not found" }, { status: 404 });

  const confirmedTotal = await prisma.payment.aggregate({
    where: { transactionId: id, status: "CONFIRMED" },
    _sum: { amount: true },
  });
  const paid = confirmedTotal._sum.amount ?? 0;
  const outstanding = txn.totalPayable - paid;
  const replacedLines = await prisma.receipt.findMany({
    where: { transactionId: id, voidedAt: { not: null } },
    select: { ref: true, payment: { select: { paymentDate: true } } },
  });

  const greeting = `<p>Dear ${formatDisplayName(txn.customerName).split(" ")[0]}, while reconciling your account we corrected how ` +
    `${replacements.length === 1 ? "one of your payments was" : `${replacements.length} of your payments were`} recorded. ` +
    `Your total payments of ${formatNaira(paid)} are unchanged. The attached receipts replace ` +
    `the earlier ${replacedLines.map((r) => r.ref).join(" and ") || "ones"}, which showed different amounts, ` +
    `and the corrected statement shows your full position. Please disregard the earlier receipts. ` +
    `Your outstanding balance is ${formatNaira(outstanding)}. Contact us on +234 8103760063 if anything looks different from your records.</p>`;
  const html =
    greeting +
    (extraNote ? `<p>${extraNote.replace(/</g, "&lt;")}</p>` : "") +
    `<p>You can also view your statement anytime at:<br/><a href="${statementVerifyUrl(stmtRow.token)}">${statementVerifyUrl(stmtRow.token)}</a></p>` +
    `<p>Belgrove Homes and Properties Limited<br/>www.belgrovehomes.com · info@belgrovehomes.com · +234 8103760063</p>`;

  const attachments = [
    ...replacements.map((r) => ({ filename: `Belgrove-${r.ref}.pdf`, content: Buffer.from(r.pdfData!), contentType: "application/pdf" })),
    { filename: `Belgrove-${stmtRow.number}.pdf`, content: Buffer.from(stmtRow.pdfData), contentType: "application/pdf" },
  ];

  const { sendEmail } = await import("@/lib/email/sendEmail");
  let result: { sent: boolean; error: string | null; providerMessageId?: string | null };
  try {
    result = await sendEmail({
      to,
      subject: `Corrected receipts and statement, ${txn.ref}`,
      html,
      attachments,
      idempotencyKey: key,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Email failed";
    logServerError(`correction email ${id}`, e);
    result = { sent: false, error: msg };
  }

  if (result.sent) {
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      if (replacements.length > 0) {
        await tx.receipt.updateMany({
          where: { id: { in: replacements.map((r) => r.id) } },
          data: { sentAt: now, recipientEmail: to, resendEmailId: result.providerMessageId ?? null },
        });
      }
      await tx.statement.update({
        where: { id: stmtRow.id },
        data: { emailSentAt: now, emailRecipient: to, resendEmailId: result.providerMessageId ?? null },
      });
      await tx.auditEvent.create({
        data: {
          actorId: session!.user.id,
          actorName: session!.user.name ?? session!.user.email ?? "Unknown",
          action: "correction.email",
          entityType: "transaction",
          entityId: id,
          before: { emailed: false },
          after: { sent: true, to, receipts: replacements.map((r) => r.ref), statement: stmtRow.number, resendEmailId: result.providerMessageId ?? null },
        },
      });
    });
    return NextResponse.json({ sent: true, to, receipts: replacements.map((r) => r.ref), statement: stmtRow.number });
  }
  if (result.error && /timed out/i.test(result.error)) {
    return NextResponse.json(
      { error: "The send timed out and may have delivered. Check Resend before retrying.", idempotencyKey: key, retryable: true },
      { status: 503 }
    );
  }
  return NextResponse.json({ error: result.error ?? "Email failed" }, { status: 502 });
}
