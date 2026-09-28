import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import NewTransactionForm from "./NewTransactionForm";

export const dynamic = "force-dynamic";

export default async function NewTransactionPage({ searchParams }: { searchParams: Promise<{ bookingId?: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) redirect("/admin/login");
  const { bookingId } = await searchParams;

  // Idempotent handoff: a booking links to at most one transaction —
  // if it already has one, go straight there instead of double-creating.
  if (bookingId) {
    const existing = await prisma.transaction.findUnique({ where: { bookingId }, select: { id: true } });
    if (existing) redirect(`/admin/transactions/${existing.id}`);
  }

  const [plans, agents, bookings] = await Promise.all([
    prisma.paymentPlan.findMany({ where: { isActive: true }, orderBy: { durationMonths: "asc" } }),
    prisma.agent.findMany({ where: { isActive: true }, select: { id: true, name: true, category: true }, orderBy: { name: "asc" } }),
    prisma.inspectionBooking.findMany({
      where: { status: { in: ["new", "under_review", "on_hold", "approved", "rescheduled", "active"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, ref: true, name: true, email: true, phone: true, location: true, estate: true, plotCode: true, unitPrice: true, plotQuantity: true, sqm: true },
    }),
  ]);

  // The handoff booking may be closed/sold (outside the dropdown above) —
  // fetch it explicitly so preselect always resolves.
  let bookingOptions = bookings;
  if (bookingId && !bookings.some((b) => b.id === bookingId)) {
    const linked = await prisma.inspectionBooking.findUnique({
      where: { id: bookingId },
      select: { id: true, ref: true, name: true, email: true, phone: true, location: true, estate: true, plotCode: true, unitPrice: true, plotQuantity: true, sqm: true },
    });
    if (linked) bookingOptions = [linked, ...bookings];
  }

  return (
    <div className="min-h-screen bg-[var(--ops-bg)]">
      <div className="max-w-[900px] mx-auto px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="font-serif text-[26px] tracking-[-0.02em] text-[var(--ops-text)]">New Transaction</h1>
          <p className="public text-[13px] text-[var(--ops-muted)] mt-1">Create a property transaction: select client, property, payment plan. System generates TXN reference and installment schedule. Record initial payment and issue receipt in one flow.</p>
        </div>
        <NewTransactionForm plans={plans as any} agents={agents} bookings={bookingOptions as any} initialBookingId={bookingId} />
      </div>
    </div>
  );
}
