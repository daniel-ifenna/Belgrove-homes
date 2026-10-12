import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { buildStatementModel } from "@/lib/statement-model";
import { renderStatementPdf } from "@/lib/statement-pdf";
import { chromiumErrorCode } from "@/lib/statement-chromium";
import { logServerError } from "@/lib/paymentConfirmation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// DRAFT preview: rendered on the fly through the single statement pipeline
// (model → supplied template → Chromium), marked DRAFT, no number, no stamp,
// no QR, no footer block. Nothing is stored and it can never be emailed.
// Invariant failures render as a red banner (never silently); Generate is
// blocked separately. Never cached.
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const txn = await prisma.transaction.findUnique({ where: { id }, select: { ref: true } });
    if (!txn) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    const model = await buildStatementModel(prisma as never, { transactionId: id, draft: true });
    const pdf = await renderStatementPdf(model, {});
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Belgrove-Statement-${txn.ref}-DRAFT.pdf"`,
        "Cache-Control": "private, no-store, must-revalidate",
      },
    });
  } catch (e) {
    logServerError(`statement preview ${id}`, e);
    return NextResponse.json(
      { error: "Couldn't build the preview right now. Please try again.", code: chromiumErrorCode(e) },
      { status: 500 }
    );
  }
}
