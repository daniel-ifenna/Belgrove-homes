import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { excludeTestTransactions } from "@/lib/test-data";

export const dynamic = "force-dynamic";

// Powers the sidebar "Monthly Target" widget — sold this month vs. goal.
export async function GET() {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const goal = Number(process.env.MONTHLY_SALES_TARGET) || 150_000_000;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);

  const agg = await prisma.receipt.aggregate({
    // Test fixtures never appear in metrics (Phase 2 finance service replaces
    // this receipt-sum with confirmed-payment revenue).
    where: { ...excludeTestTransactions(false), issuedAt: { gte: start }, status: { in: ["sent", "generated"] } },
    _sum: { finalAmount: true },
  });
  const sold = agg._sum.finalAmount ?? 0;

  return NextResponse.json({
    soldThisMonth: sold,
    goal,
    pct: goal > 0 ? Math.min(100, Math.round((sold / goal) * 100)) : 0,
  });
}
