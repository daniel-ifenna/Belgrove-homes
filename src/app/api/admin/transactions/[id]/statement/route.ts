import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { issueStatement } from "@/lib/statements";
import { toUserFacingLedgerError, logLedgerError } from "@/lib/finance/ledger";

export const dynamic = "force-dynamic";

// Download: serves the stored statement for the current ledger (issues one
// first when none exists or the ledger changed since the latest). Downloading
// NEVER emails — email happens only through the explicit per-statement
// endpoint after admin confirmation.
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const { statement } = await issueStatement(prisma as never, {
      transactionId: id,
      actorId: session!.user.id,
      actorName: session!.user.name ?? session!.user.email ?? "Unknown",
    });
    const row = await prisma.statement.findUnique({ where: { id: statement.id }, select: { number: true, pdfData: true } });
    if (!row) return NextResponse.json({ error: "Statement not found" }, { status: 404 });
    return new NextResponse(new Uint8Array(Buffer.from(row.pdfData)), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Belgrove-${row.number}.pdf"`,
        "Cache-Control": "private, no-store, must-revalidate",
      },
    });
  } catch (e) {
    logLedgerError(`statement download ${id}`, e);
    const msg = e instanceof Error ? e.message : String(e);
    const code = /chromium|chrome|launch|browser|executable/i.test(msg)
      ? "RENDER_FAILED"
      : /asset missing|U\+20A6|font/i.test(msg)
        ? "ASSET_MISSING"
        : "BUILD_FAILED";
    return NextResponse.json({ error: toUserFacingLedgerError(e), code }, { status: 500 });
  }
}
