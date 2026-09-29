import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { redirect } from "next/navigation";
import { formatLagos } from "@/lib/time";
export const dynamic = "force-dynamic";

// Inspections conducted: read-only history of every inspection that took
// place (inspectedAt set), newest first. All actions happen on the booking
// page — this list links there and mutates nothing.
export default async function InspectionsConductedPage({ searchParams }: { searchParams: Promise<{ showTest?: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) redirect("/admin/login");
  const showTest = (await searchParams).showTest === "1";
  const testFilter = showTest ? {} : { isTest: false };
  const rows = await prisma.inspectionBooking.findMany({
    where: { inspectedAt: { not: null }, ...testFilter },
    orderBy: [{ inspectedAt: "desc" }, { updatedAt: "desc" }],
    include: { agent: true },
    take: 100,
  });

  return (
    <div className="min-h-screen bg-[var(--ops-bg)]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-serif text-[28px] lg:text-[32px] tracking-[-0.02em] text-[var(--ops-text)] leading-none">Inspections conducted</h1>
            <p className="public text-[13px] leading-[1.5] text-[var(--ops-muted)] mt-2">Every inspection that took place, newest first. Outcomes and follow-ups live on the booking page.</p>
            <p className="mono text-[11px] tracking-wide uppercase text-[var(--ops-muted)] mt-1">
              {rows.length} conducted
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/bookings" className="mono text-[11px] tracking-wide uppercase bg-[var(--ops-primary)] text-white rounded-full px-4 py-2 hover:bg-[var(--ops-deep)]">
              All Bookings
            </Link>
          </div>
        </div>

        <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] overflow-hidden shadow-[var(--ops-shadow-sm)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm admin-table">
              <thead>
                <tr className="bg-[var(--ops-bg)]/60 border-b border-[var(--ops-border)] text-left">
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Inspection</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Client</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Agent</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Outcome</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)] text-right">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ops-border)]/60">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-[var(--ops-bg)]/50">
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-medium text-[var(--ops-text)] leading-tight">{r.estate ?? r.location}</div>
                      <div className="mono text-[11px] text-[var(--ops-muted)] mt-0.5">{r.ref} · Inspected {r.inspectedAt ? formatLagos(r.inspectedAt, "datetime") : "-"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-medium text-[var(--ops-text)] leading-tight">{r.name}</div>
                      <div className="mono text-[11px] text-[var(--ops-muted)]">{r.email}</div>
                    </td>
                    <td className="px-4 py-3 mono text-[12px] text-[var(--ops-text)]">{r.agent ? r.agent.name : (r.agentName ?? "-")}</td>
                    <td className="px-4 py-3">
                      {r.outcome ? (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium border bg-white">{r.outcome}</span>
                      ) : (
                        <span className="mono text-[11px] text-[var(--ops-muted)]">Awaiting outcome</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/bookings/${r.id}`} className="mono text-[11px] text-[var(--ops-primary)] hover:underline underline-offset-4">Open →</Link>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center">
                      <p className="public text-[14px] font-medium text-[var(--ops-text)]">No inspections conducted yet</p>
                      <p className="mono text-[11px] text-[var(--ops-muted)] mt-1">Inspections appear here once marked as held on the booking page.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
