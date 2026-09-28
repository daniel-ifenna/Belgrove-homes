import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { getMonthlyTargetProgress } from "@/lib/finance";

export const dynamic = "force-dynamic";

// Powers the sidebar "Monthly Target" widget — same finance service as the
// dashboard card, so the two can never disagree. ?showTest=1 includes fixtures
// (the sidebar widget passes the dashboard toggle state through).
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const showTest = new URL(request.url).searchParams.get("showTest") === "1";
  const target = await getMonthlyTargetProgress(new Date(), undefined, { includeTest: showTest });

  return NextResponse.json({
    soldThisMonth: target.collected,
    goal: target.goal,
    pct: target.pct,
  });
}
