import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { getMonthlyTargetProgress } from "@/lib/finance";

export const dynamic = "force-dynamic";

// Powers the sidebar "Monthly Target" widget — same finance service as the
// dashboard card, so the two can never disagree.
export async function GET() {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const target = await getMonthlyTargetProgress(new Date());

  return NextResponse.json({
    soldThisMonth: target.collected,
    goal: target.goal,
    pct: target.pct,
  });
}
