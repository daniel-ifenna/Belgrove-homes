import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { issueStatement, StatementDataError } from "@/lib/statements";
import { buildStatementModel } from "@/lib/statement-model";
import { toUserFacingLedgerError, logLedgerError } from "@/lib/finance/ledger";

export const maxDuration = 60;

// Generate (issue) a statement: stored immutable PDF + number + token.
// Same ledger → existing statement returned; changed ledger → new one.
// Invariant failures BLOCK generation (409 + problem list). Warnings
// (assumed contract date, unmatched bank ticks, pending verification) require
// an explicit "Issue anyway" acknowledgement, which is audit-logged.
// Generating NEVER sends anything.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const acknowledgeWarnings = body?.acknowledgeWarnings === true;
  try {
    // Read-only pre-check so the dialog can show warnings/blockers first.
    const model = await buildStatementModel(prisma as never, { transactionId: id, draft: true });
    if (model.dataCheckErrors.length > 0) {
      return NextResponse.json(
        { error: "Statement data check failed — generation blocked.", problems: model.dataCheckErrors },
        { status: 409 }
      );
    }
    if (model.warnings.length > 0 && !acknowledgeWarnings) {
      return NextResponse.json(
        { error: "This statement has warnings. Tick “Issue anyway” to proceed.", warnings: model.warnings, requiresAck: true },
        { status: 409 }
      );
    }
    const result = await issueStatement(prisma as never, {
      transactionId: id,
      actorId: session!.user.id,
      actorName: session!.user.name ?? session!.user.email ?? "Unknown",
      warnAcknowledged: acknowledgeWarnings,
    });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (e) {
    if (e instanceof StatementDataError) {
      return NextResponse.json(
        { error: "Statement data check failed — generation blocked.", problems: e.problems },
        { status: 409 }
      );
    }
    logLedgerError(`issue statement ${id}`, e);
    return NextResponse.json(
      { error: toUserFacingLedgerError(e), code: statementErrorCode(e) },
      { status: 500 }
    );
  }
}

function statementErrorCode(e: unknown): "RENDER_FAILED" | "ASSET_MISSING" | "BUILD_FAILED" {
  const msg = e instanceof Error ? e.message : String(e);
  if (/chromium|chrome|launch|browser|executable/i.test(msg)) return "RENDER_FAILED";
  if (/asset missing|U\+20A6|font/i.test(msg)) return "ASSET_MISSING";
  return "BUILD_FAILED";
}
