import Link from "next/link";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
import InspectionsClient from "./InspectionsClient";
import TestDataToggle from "@/components/admin/TestDataToggle";

export default async function CompletedInspectionsPage({ searchParams }: { searchParams: Promise<{ showTest?: string }> }) {
  const showTest = (await searchParams).showTest === "1";
  // Completed inspections = status active (inspection held), awaiting sold/not-sold outcome
  // Includes both plain active and active+interested (hot lead awaiting final decision)
  const testFilter = showTest ? {} : { isTest: false };
  const rows = await prisma.inspectionBooking.findMany({
    where: { status: "active", ...testFilter },
    orderBy: [{ updatedAt: "desc" }],
    include: { agent: true },
    take: 100,
  });

  // Also count not-converted (closed with not_sold) for filter hint
  const notConvertedCount = await prisma.inspectionBooking.count({ where: { outcome: "not_sold", ...testFilter } });
  const soldCount = await prisma.inspectionBooking.count({ where: { outcome: "sold", ...testFilter } });

  const mapped = rows.map((b) => ({
    id: b.id,
    ref: b.ref,
    name: b.name,
    email: b.email,
    location: b.location,
    estate: (b as any).estate ?? null,
    plotCode: (b as any).plotCode ?? null,
    unitType: (b as any).unitType ?? null,
    sqm: (b as any).sqm ?? null,
    sqmNeeded: (b as any).sqmNeeded ?? null,
    selectionType: (b as any).selectionType ?? null,
    plotQuantity: (b as any).plotQuantity ?? null,
    unitPrice: (b as any).unitPrice ?? null,
    agent: b.agent ? { name: b.agent.name, category: b.agent.category } : null,
    agentName: b.agentName,
    status: b.status,
    preferredDate: b.preferredDate.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-[var(--ops-bg)]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-serif text-[28px] lg:text-[32px] tracking-[-0.02em] text-[var(--ops-text)] leading-none">Completed Inspections</h1>
            <p className="public text-[13px] leading-[1.5] text-[var(--ops-muted)] mt-2">Inspections that have taken place — awaiting Sold / Not Sold outcome. Sold triggers receipt generation.</p>
            <p className="mono text-[11px] tracking-wide uppercase text-[var(--ops-muted)] mt-1">
              {rows.length} awaiting · {soldCount} sold · {notConvertedCount} not converted
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TestDataToggle href={showTest ? "/admin/inspections" : "/admin/inspections?showTest=1"} showing={showTest} />
            <Link href="/admin/bookings?status=closed" className="mono text-[11px] tracking-wide uppercase bg-white border border-[var(--ops-border)] rounded-full px-4 py-2 hover:bg-[var(--ops-bg)]">
              View Not Converted ({notConvertedCount})
            </Link>
            <Link href="/admin/bookings" className="mono text-[11px] tracking-wide uppercase bg-[var(--ops-primary)] text-white rounded-full px-4 py-2 hover:bg-[var(--ops-deep)]">
              All Bookings
            </Link>
          </div>
        </div>

        <InspectionsClient rows={mapped} />

        {soldCount > 0 && (
          <div className="mt-6 bg-white border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-4 flex items-start gap-3">
            <span className="h-8 w-8 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] grid place-items-center text-xs">✓</span>
            <div>
              <div className="text-[13px] font-medium text-[var(--ops-text)]">Sold receipts</div>
              <p className="mono text-[11px] text-[var(--ops-muted)] mt-1">Sold rows show <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">Receipt sent</span> in the bookings list and link to <span className="font-mono">/receipts/{`{ref}`}</span>. QR codes on the PDF point to that URL.</p>
              <Link href="/admin/bookings?status=closed" className="mono text-[11px] text-[var(--ops-primary)] underline underline-offset-4 mt-2 inline-block">View sold bookings →</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
