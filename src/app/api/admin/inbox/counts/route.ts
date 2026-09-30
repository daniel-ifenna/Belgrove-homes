import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
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
  // Bookings still needing action: New, Under Review, or unassigned and not
  // closed. Approved/assigned/active/sold/closed bookings drop out.
  const [underReview, unassignedOpen] = await Promise.all([
    prisma.inspectionBooking.count({ where: { status: "under_review", isTest: false } }),
    prisma.inspectionBooking.count({
      where: { agentId: null, status: { notIn: ["closed", "new", "under_review"] }, isTest: false },
    }),
  ]);
  const bookingsNeedsAction =
    counts.byCategory.BOOKING_NEW + underReview + unassignedOpen;
  return NextResponse.json({
    total: counts.total,
    pendingPayments: counts.byCategory.PAYMENT_PENDING_VERIFICATION,
    bookingsNewUnassigned:
      counts.byCategory.BOOKING_NEW + counts.byCategory.BOOKING_UNASSIGNED,
    bookingsNeedsAction,
    byCategory: counts.byCategory,
  });
}
