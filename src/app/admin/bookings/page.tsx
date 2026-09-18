import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma, BookingStatus, LeadTemperature } from "@/generated/prisma/client";
import { allStatuses, allTemperatures, statusColors, statusLabels, temperatureColors, formatDate } from "@/lib/booking-ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type SearchParams = {
  status?: string;
  leadTemperature?: string;
  missingAgent?: string;
  agentId?: string;
  q?: string;
  page?: string;
};

function AgentCell({ agent }: { agent: { name: string; category: string } | null }) {
  if (agent) {
    return (
      <div className="flex items-center gap-2.5">
        <span className="h-8 w-8 rounded-full bg-[var(--ops-primary)] text-white grid place-items-center text-[11px] font-medium shrink-0">
          {agent.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
        </span>
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-medium text-[var(--ops-text)] leading-none truncate">{agent.name}</span>
          <span className={`mt-1 inline-flex w-fit px-1.5 py-0.5 rounded-full text-[10px] leading-none border font-medium ${agent.category === "staff" ? "bg-[#E0F2F1] text-[#0D3328] border-[#B2DFDB]" : "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]"}`}>
            {agent.category === "hire_purchase" ? "Hire Purchase" : "Staff"}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="h-8 w-8 rounded-full border border-dashed border-[var(--ops-border)] bg-[var(--ops-bg)] grid place-items-center text-[10px] text-[var(--ops-muted)]">—</span>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-white border border-[var(--ops-border)] text-[var(--ops-muted)]">Unassigned</span>
    </div>
  );
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const q = params.q?.trim() ?? "";

  const where: Prisma.InspectionBookingWhereInput = {};
  if (params.status && (allStatuses as readonly string[]).includes(params.status)) {
    where.status = params.status as BookingStatus;
  }
  if (params.leadTemperature && (allTemperatures as readonly string[]).includes(params.leadTemperature)) {
    where.leadTemperature = params.leadTemperature as LeadTemperature;
  }
  if (params.missingAgent === "1") {
    where.agentId = null;
  }
  if (params.agentId) {
    where.agentId = params.agentId;
  }
  if (q) {
    where.OR = [
      { ref: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { location: { contains: q, mode: "insensitive" } },
    ];
  }

  const [bookings, total, agentsForFilter] = await Promise.all([
    prisma.inspectionBooking.findMany({
      where,
      orderBy: [{ preferredDate: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { agent: true },
    }),
    prisma.inspectionBooking.count({ where }),
    prisma.agent.findMany({ where: { isActive: true }, select: { id: true, name: true, category: true }, orderBy: { name: "asc" } }),
  ]);

  const nonClosed = await prisma.inspectionBooking.findMany({
    where: { status: { not: "closed" } },
    select: { id: true, email: true, phone: true, preferredDate: true, rescheduledDate: true },
  });
  const dupMap = new Map<string, string[]>();
  function isDup(a: (typeof nonClosed)[number], b: (typeof nonClosed)[number]): boolean {
    if (a.id === b.id) return false;
    const sameContact =
      (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) ||
      (a.phone && b.phone && a.phone.replace(/\D/g, "") === b.phone.replace(/\D/g, ""));
    if (!sameContact) return false;
    const aDate = (a.rescheduledDate ?? a.preferredDate).getTime();
    const bDate = (b.rescheduledDate ?? b.preferredDate).getTime();
    const diffDays = Math.abs(aDate - bDate) / (1000 * 60 * 60 * 24);
    return diffDays <= 3;
  }
  for (const b of bookings) {
    const matches = nonClosed.filter((o) => isDup(b as any, o));
    if (matches.length > 0) dupMap.set(b.id, matches.map((m) => m.id));
  }

  const sorted = [...bookings].sort((a, b) => {
    const ma = a.agentId ? 1 : 0;
    const mb = b.agentId ? 1 : 0;
    if (ma !== mb) return ma - mb;
    return new Date(a.preferredDate).getTime() - new Date(b.preferredDate).getTime();
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildQuery(overrides: Partial<SearchParams>) {
    const merged = { ...params, ...overrides };
    const qs = new URLSearchParams();
    if (merged.status) qs.set("status", merged.status);
    if (merged.leadTemperature) qs.set("leadTemperature", merged.leadTemperature);
    if (merged.missingAgent) qs.set("missingAgent", merged.missingAgent);
    if (merged.agentId) qs.set("agentId", merged.agentId);
    if (merged.q) qs.set("q", merged.q);
    if (merged.page && merged.page !== "1") qs.set("page", merged.page);
    const str = qs.toString();
    return str ? `?${str}` : "";
  }

  const statusFilters = [
    { label: "All bookings", value: "" },
    { label: "New", value: "new" },
    { label: "Under Review", value: "under_review" },
    { label: "Approved", value: "approved" },
    { label: "Rescheduled", value: "rescheduled" },
    { label: "Active", value: "active" },
    { label: "Closed", value: "closed" },
  ];

  return (
    <div className="min-h-screen bg-[var(--ops-bg)]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6">
        {/* Header — command center */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-serif text-[28px] lg:text-[32px] tracking-[-0.02em] text-[var(--ops-text)] leading-none">Inspection Bookings</h1>
            <p className="public text-[13px] leading-[1.5] text-[var(--ops-muted)] mt-2">Manage inspections, appointments, leads and booking activity.</p>
            <p className="mono text-[11px] tracking-wide uppercase text-[var(--ops-muted)] mt-1">{total} bookings · Page {page} of {totalPages}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <a
              href={`/api/admin/bookings/export${buildQuery({ page: undefined })}`}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium bg-white border border-[var(--ops-border)] text-[var(--ops-text)] rounded-full px-4 py-2.5 hover:bg-[var(--ops-bg)] hover:border-[var(--ops-border-strong)] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3v12M8 11l4 4 4-4"/><path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/></svg>
              Export
            </a>
            <Link
              href="/book-inspection"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium bg-[var(--ops-primary)] text-white rounded-full px-5 py-2.5 hover:bg-[var(--ops-deep)] transition-colors shadow-sm"
            >
              <span className="text-[16px] leading-none">+</span> New Booking
            </Link>
          </div>
        </div>

        {/* Filter Bar — premium */}
        <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-4 shadow-[var(--ops-shadow-sm)] mb-4">
          <div className="flex flex-col xl:flex-row gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-1.5">
                {statusFilters.map((f) => {
                  const active = (params.status ?? "") === f.value;
                  return (
                    <Link
                      key={f.label}
                      href={`/admin/bookings${buildQuery({ status: f.value || undefined, page: "1" })}`}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${active ? "bg-[var(--ops-primary)] text-white border-[var(--ops-primary)]" : "bg-white border-[var(--ops-border)] text-[var(--ops-muted)] hover:border-[var(--ops-border-strong)] hover:text-[var(--ops-text)]"}`}
                    >
                      {f.label}
                    </Link>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                <span className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)] self-center mr-1">Lead:</span>
                {[
                  { label: "All", value: "" },
                  { label: "Hot", value: "hot" },
                  { label: "Warm", value: "warm" },
                  { label: "Cold", value: "cold" },
                ].map((f) => {
                  const active = (params.leadTemperature ?? "") === f.value;
                  return (
                    <Link
                      key={f.label}
                      href={`/admin/bookings${buildQuery({ leadTemperature: f.value || undefined, page: "1" })}`}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${active ? "bg-[var(--ops-primary)] text-white border-[var(--ops-primary)]" : f.value === "hot" ? "bg-[#FEF2F2] text-[#9F1239] border-[#FECACA] hover:bg-[#FEE2E2]" : f.value === "warm" ? "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A] hover:bg-[#FEF3C7]" : f.value === "cold" ? "bg-[#F1F3F2] text-[#4B5563] border-[#E3E6E1] hover:bg-[#E8ECEE]" : "bg-white border-[var(--ops-border)] text-[var(--ops-muted)]"}`}
                    >
                      {f.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <form className="flex flex-wrap gap-2 items-start xl:justify-end" action="/admin/bookings" method="get">
              {params.status && <input type="hidden" name="status" value={params.status} />}
              {params.leadTemperature && <input type="hidden" name="leadTemperature" value={params.leadTemperature} />}
              <select
                name="agentId"
                defaultValue={params.agentId ?? ""}
                className="border border-[var(--ops-border)] rounded-full px-3 py-2 text-xs bg-white min-w-[140px] focus:outline-none focus:ring-2 focus:ring-[var(--ops-primary)]/10"
              >
                <option value="">All agents</option>
                {agentsForFilter.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs bg-white border border-[var(--ops-border)] rounded-full px-3 py-2 cursor-pointer hover:bg-[var(--ops-bg)]">
                <input type="checkbox" name="missingAgent" value="1" defaultChecked={params.missingAgent === "1"} className="rounded border-[var(--ops-border)]" />
                <span className="text-[var(--ops-text)]">Missing agent</span>
              </label>
              <button type="submit" className="text-xs bg-[var(--ops-primary)] text-white rounded-full px-4 py-2 font-medium hover:bg-[var(--ops-deep)] transition-colors">
                Apply
              </button>
              {(params.status || params.leadTemperature || params.missingAgent || params.agentId || params.q) && (
                <Link href="/admin/bookings" className="text-xs text-[var(--ops-muted)] self-center underline underline-offset-4 hover:text-[var(--ops-text)]">
                  Clear
                </Link>
              )}
            </form>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <form className="flex-1 relative" action="/admin/bookings" method="get">
              {params.status && <input type="hidden" name="status" value={params.status} />}
              {params.leadTemperature && <input type="hidden" name="leadTemperature" value={params.leadTemperature} />}
              {params.agentId && <input type="hidden" name="agentId" value={params.agentId} />}
              {params.missingAgent && <input type="hidden" name="missingAgent" value={params.missingAgent} />}
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ops-muted)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
              </span>
              <input
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Search by name, email, reference..."
                className="w-full bg-[var(--ops-bg)] border border-[var(--ops-border)] rounded-full pl-9 pr-4 py-2.5 text-[13px] placeholder:text-[var(--ops-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ops-primary)]/10 focus:border-[var(--ops-primary)]/20"
              />
            </form>
          </div>
        </div>

        {/* Table — desktop */}
        <div className="hidden lg:block bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] overflow-hidden shadow-[var(--ops-shadow-sm)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--ops-bg)]/60 border-b border-[var(--ops-border)] text-left">
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Booking Reference</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Customer</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Property</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Inspection</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Status</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Lead</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Agent</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Outcome</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Updated</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ops-border)]/60">
                {sorted.map((b) => (
                  <tr key={b.id} className="hover:bg-[var(--ops-bg)]/50 transition-colors group">
                    <td className="px-4 py-3.5">
                      <Link href={`/admin/bookings/${b.id}`} className="font-mono text-[12px] font-medium text-[var(--ops-primary)] hover:underline group-hover:text-[var(--ops-deep)]">
                        {b.ref}
                      </Link>
                      <div className="mono text-[10px] text-[var(--ops-muted)] mt-0.5">{new Date(b.createdAt).toLocaleDateString("en-GB")}</div>
                      {dupMap.has(b.id) && (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-50 text-amber-800 border border-amber-200">⚠ Duplicate</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-medium text-[var(--ops-text)] leading-none truncate max-w-[160px]">{b.name}</div>
                      <div className="text-[12px] text-[var(--ops-muted)] truncate max-w-[160px]">{b.email}</div>
                      {b.phone && <div className="text-[11px] text-[var(--ops-muted)]">{b.phone}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[13px] text-[var(--ops-text)] leading-tight max-w-[160px] truncate">{b.location}</div>
                      <div className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)] mt-0.5">{b.agentName ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3">
                      {b.rescheduledDate ? (
                        <div>
                          <div className="text-[13px] font-medium text-[var(--ops-text)]">{formatDate(b.rescheduledDate)}</div>
                          <div className="text-[11px] text-[var(--ops-muted)]">{b.rescheduledTime}</div>
                          <span className="inline-flex mt-1 px-1.5 py-0.5 rounded-full text-[10px] bg-[#F5F0FF] text-[#5B21B6] border border-[#DDD6FE]">Rescheduled</span>
                        </div>
                      ) : (
                        <div>
                          <div className="text-[13px] text-[var(--ops-text)]">{formatDate(b.preferredDate)}</div>
                          <div className="text-[11px] text-[var(--ops-muted)]">{b.preferredTime}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium border ${statusColors[b.status]}`}>{statusLabels[b.status]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-medium border ${temperatureColors[b.leadTemperature]}`}>{b.leadTemperature.toUpperCase()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <AgentCell agent={(b as any).agent} />
                    </td>
                    <td className="px-4 py-3">
                      {b.outcome ? (
                        <span className={`inline-flex px-2 py-1 rounded-full text-[11px] font-medium border ${b.outcome === "sold" ? "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]" : b.outcome === "interested" ? "bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]" : "bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]"}`}>{b.outcome}</span>
                      ) : (
                        <span className="text-[12px] text-[var(--ops-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 mono text-[11px] text-[var(--ops-muted)]">{new Date(b.updatedAt).toLocaleDateString("en-GB")}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/bookings/${b.id}`} className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--ops-primary)] hover:text-[var(--ops-deep)] border border-[var(--ops-border)] rounded-full px-3 py-1.5 bg-white hover:bg-[var(--ops-bg)] transition-colors">
                        View
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 18l6-6-6-6"/></svg>
                      </Link>
                    </td>
                  </tr>
                ))}
                {bookings.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center">
                      <div className="max-w-[320px] mx-auto">
                        <div className="h-10 w-10 rounded-full bg-[var(--ops-bg)] border border-[var(--ops-border)] grid place-items-center mx-auto text-[var(--ops-muted)]">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                        </div>
                        <p className="public text-[14px] font-medium text-[var(--ops-text)] mt-3">No bookings match these filters</p>
                        <p className="public text-[12px] text-[var(--ops-muted)] mt-1">Try adjusting your filters or search terms, or create a new booking.</p>
                        <Link href="/admin/bookings" className="inline-flex mt-4 text-xs bg-white border border-[var(--ops-border)] rounded-full px-4 py-2 hover:bg-[var(--ops-bg)]">Clear filters</Link>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="lg:hidden space-y-3 mt-4">
          {sorted.map((b) => (
            <Link key={b.id} href={`/admin/bookings/${b.id}`} className="block bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-4 shadow-[var(--ops-shadow-sm)] hover:shadow-[var(--ops-shadow-md)] transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-[12px] font-medium text-[var(--ops-primary)]">{b.ref}</div>
                  <div className="text-[14px] font-medium text-[var(--ops-text)] mt-1">{b.name}</div>
                  <div className="text-[12px] text-[var(--ops-muted)] truncate">{b.email}</div>
                </div>
                <div className="flex flex-col gap-1.5 items-end shrink-0">
                  <span className={`px-2 py-1 rounded-full text-[11px] font-medium border ${statusColors[b.status]}`}>{statusLabels[b.status]}</span>
                  <span className={`px-2 py-1 rounded-full text-[11px] font-medium border ${temperatureColors[b.leadTemperature]}`}>{b.leadTemperature.toUpperCase()}</span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">Property</div>
                  <div className="text-[13px] text-[var(--ops-text)] truncate">{b.location}</div>
                </div>
                <div>
                  <div className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">Inspection</div>
                  <div className="text-[13px] text-[var(--ops-text)]">{b.rescheduledDate ? formatDate(b.rescheduledDate) : formatDate(b.preferredDate)} · {b.rescheduledTime ?? b.preferredTime}</div>
                </div>
                <div>
                  <div className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">Agent</div>
                  <div className="mt-1"><AgentCell agent={(b as any).agent} /></div>
                </div>
                <div>
                  <div className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">Outcome</div>
                  <div className="mt-1">{b.outcome ? <span className="text-xs px-2 py-1 rounded-full border bg-white">{b.outcome}</span> : <span className="text-[var(--ops-muted)]">—</span>}</div>
                </div>
              </div>
            </Link>
          ))}
          {bookings.length === 0 && (
            <div className="bg-white border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-8 text-center">
              <p className="text-sm text-[var(--ops-muted)]">No bookings found.</p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <span className="mono text-[11px] tracking-wide uppercase text-[var(--ops-muted)]">Page {page} of {totalPages} · {total} total</span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={`/admin/bookings${buildQuery({ page: String(page - 1) })}`} className="text-xs bg-white border border-[var(--ops-border)] rounded-full px-4 py-2 hover:bg-[var(--ops-bg)]">Previous</Link>
              )}
              {page < totalPages && (
                <Link href={`/admin/bookings${buildQuery({ page: String(page + 1) })}`} className="text-xs bg-[var(--ops-primary)] text-white rounded-full px-4 py-2 hover:bg-[var(--ops-deep)]">Next</Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
