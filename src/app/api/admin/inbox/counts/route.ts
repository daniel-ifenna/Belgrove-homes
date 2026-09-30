import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { getActionCounts } from "@/lib/inbox";
import { drainOutboxOnAdminInboxLoad } from "@/lib/email/outbox";

export const dynamic = "force-dynamic";

// Sidebar badges + inbox chips. Real rows only (fixtures never badge).
export async function GET() {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Same background drain as the inbox page (guarded to once per 60s per
  // server instance): badge polling keeps deferred mail moving.
  drainOutboxOnAdminInboxLoad();
  const counts = await getActionCounts();
  return NextResponse.json({
    total: counts.total,
    pendingPayments: counts.byCategory.PAYMENT_PENDING_VERIFICATION,
    bookingsNewUnassigned:
      counts.byCategory.BOOKING_NEW + counts.byCategory.BOOKING_UNASSIGNED,
    byCategory: counts.byCategory,
  });
}
