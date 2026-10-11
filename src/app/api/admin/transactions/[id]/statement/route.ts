import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { generateStatementPdf, type StatementEntry } from "@/lib/statement";
import { formatDisplayName } from "@/lib/formatName";
import { logServerError } from "@/lib/paymentConfirmation";

export const dynamic = "force-dynamic";

// On-demand Statement of Account PDF: chronological ledger (charges,
// payments, discounts, reversals) with running + closing balances. Same
// branding as receipts. No QR graphic — there is no public statement page;
// each payment row carries its verifiable receipt ref instead.
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
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
    const pdf = generateStatementPdf({
      transactionRef: txn.ref,
      bookingRef: txn.booking?.ref ?? null,
      clientName: formatDisplayName(txn.customerName),
      clientPhone: txn.customerPhone ?? "",
      clientEmail: txn.customerEmail,
      propertyLine: `${txn.estate}${txn.unitType ? ` · ${txn.unitType}` : ""}${txn.plotCode ? ` · ${txn.plotCode}` : ""}`,
      entries,
      generatedAt: new Date(),
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Belgrove-Statement-${txn.ref}.pdf"`,
        "Cache-Control": "private, no-store, must-revalidate",
      },
    });
  } catch (e) {
    logServerError(`statement ${id}`, e);
    return NextResponse.json({ error: "Couldn't build the statement right now. Please try again." }, { status: 500 });
  }
}
