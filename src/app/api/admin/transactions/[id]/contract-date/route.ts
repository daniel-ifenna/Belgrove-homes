import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { setTransactionContractDate, toUserFacingLedgerError, logLedgerError } from "@/lib/finance/ledger";
import { toDateOnlyNoonUtc } from "@/lib/time";

// Set or correct the transaction's contract (sale) date. Re-dates the CHARGE
// entries so statements order correctly. Audited; additive-safe.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  // Calendar date, not an instant: noon-UTC normalized via the shared helper.
  let date: Date | null = null;
  try {
    date = body?.contractDate ? toDateOnlyNoonUtc(String(body.contractDate)) : null;
  } catch {
    date = null;
  }
  if (!date) {
    return NextResponse.json({ error: "A valid contract date is required" }, { status: 400 });
  }
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : null;
  try {
    const result = await prisma.$transaction((tx) =>
      setTransactionContractDate(tx as never, {
        transactionId: id,
        contractDate: date,
        actorId: session!.user.id,
        actorName: session!.user.name ?? session!.user.email ?? "Unknown",
        reason,
      })
    );
    return NextResponse.json({ contractDate: date.toISOString(), updatedCharges: result.updatedCharges });
  } catch (e) {
    logLedgerError(`contract date ${id}`, e);
    return NextResponse.json({ error: toUserFacingLedgerError(e) }, { status: 500 });
  }
}
