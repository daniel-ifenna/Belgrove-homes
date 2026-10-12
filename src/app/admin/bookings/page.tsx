import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { redirect } from "next/navigation";
import type { Prisma, BookingStatus, LeadTemperature, SaleOutcome } from "@/generated/prisma/client";
import { allOutcomes, allStatuses, allTemperatures, formatDate } from "@/lib/booking-ui";
import AdminPagination from "@/components/admin/AdminPagination";
import AdminListCard from "@/components/admin/AdminListCard";
import StatusBadge from "@/components/admin/StatusBadge";
import { WarnIcon } from "@/components/admin/icons";
import { lagosDayKey, lagosTodayInput } from "@/lib/time";
import { phonesMatch } from "@/lib/phone";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type SearchParams = {
  status?: string;
  leadTemperature?: string;
  outcome?: string;
  missingAgent?: string;
  agentId?: string;
  q?: string;
  page?: string;
  showTest?: string;
};

function AgentCell({ agent, customerEmail, customerPhone }: { agent: { name: string; category: string; email: string; phone: string } | null; customerEmail?: string; customerPhone?: string | null }) {
  const selfAssigned =
    !!agent &&
    !!customerEmail &&
    (agent.email.trim().toLowerCase() === customerEmail.trim().toLowerCase() || phonesMatch(agent.phone, customerPhone));
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
          {selfAssigned && (
            <span className="mt-1 inline-flex w-fit px-1.5 py-0.5 rounded-full text-[10px] leading-none border font-medium bg-[#FEF2F2] text-[#9F1239] border-[#FECACA]">
              <span className="inline-flex items-center gap-1"><WarnIcon size={10} /> Same as customer</span>
            </span>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="h-8 w-8 rounded-full border border-dashed border-[var(--ops-border)] bg-[var(--ops-bg)] grid place-items-center text-[10px] text-[var(--ops-muted)]">-</span>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-white border border-[var(--ops-border)] text-[var(--ops-muted)]">Unassigned</span>
    </div>
  );
}

// Upcoming / today / past chip for the scheduled inspection day (Lagos).
function InspectionTiming({ date }: { date: Date | string | null }) {
  if (!date) return null;
  const day = lagosDayKey(date);
  const today = lagosTodayInput();
  if (day === today) {
    return <span className="inline-flex mt-1 px-1.5 py-0.5 rounded-full text-[10px] bg-[#C89B3C] text-white border border-[#C89B3C]">Today</span>;
  }
  if (day > today) {
    return <span className="inline-flex mt-1 px-1.5 py-0.5 rounded-full text-[10px] bg-transparent text-[#1E3A5F] border border-[#C7D2E0]">Upcoming</span>;
  }
  return <span className="inline-flex mt-1 px-1.5 py-0.5 rounded-full text-[10px] bg-transparent text-[#6B6252] border border-[#D8CFC0]">Past</span>;
}

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) redirect("/admin/login");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const q = params.q?.trim() ?? "";
  const showTest = params.showTest === "1";

  const where: Prisma.InspectionBookingWhereInput = {};
  if (!showTest) where.isTest = false;
  if (params.status && (allStatuses as readonly string[]).includes(params.status)) {
    where.status = params.status as BookingStatus;
  }
  if (params.leadTemperature && (allTemperatures as readonly string[]).includes(params.leadTemperature)) {
    where.leadTemperature = params.leadTemperature as LeadTemperature;
  }
  if (params.outcome && (allOutcomes as readonly string[]).includes(params.outcome)) {
    where.outcome = params.outcome as SaleOutcome;
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
    where: { status: { not: "closed" }, ...(showTest ? {} : { isTest: false }) },
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

  const paginationQuery = (() => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.leadTemperature) qs.set("leadTemperature", params.leadTemperature);
    if (params.outcome) qs.set("outcome", params.outcome);
    if (params.missingAgent) qs.set("missingAgent", params.missingAgent);
    if (params.agentId) qs.set("agentId", params.agentId);
    if (params.q) qs.set("q", params.q);
    if (showTest) qs.set("showTest", "1");
    return qs.toString();
  })();

  function buildQuery(overrides: Partial<SearchParams>) {
    const merged = { ...params, ...overrides };
    const qs = new URLSearchParams();
    if (merged.status) qs.set("status", merged.status);
    if (merged.leadTemperature) qs.set("leadTemperature", merged.leadTemperature);
    if (merged.outcome) qs.set("outcome", merged.outcome);
    if (merged.missingAgent) qs.set("missingAgent", merged.missingAgent);
    if (merged.agentId) qs.set("agentId", merged.agentId);
    if (merged.q) qs.set("q", merged.q);
    if (merged.showTest) qs.set("showTest", merged.showTest);
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
      <div className="max-w-[1180px] mx-auto px-6 lg:px-7 py-6">
        <div className="ph">
          <div>
            <h1>Bookings</h1>
            <p>Inspection requests, from first contact to outcome. · {total} bookings · Page {page} of {totalPages}</p>
          </div>
          <div className="acts">
            <Link href="/admin/inspections" className="btn">Inspections conducted →</Link>
            <a
              href={`/api/admin/bookings/export${buildQuery({ page: undefined })}`}
              className="btn"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3v12M8 11l4 4 4-4"/><path d="M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/></svg>
              Export
            </a>
            <Link
              href="/book-inspection"
              className="btn pri"
            >
              <span className="text-[16px] leading-none">+</span> New Booking
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="filters">
            {statusFilters.map((f) => {
              const active = (params.status ?? "") === f.value;
              return (
                <Link
                  key={f.label}
                  href={`/admin/bookings${buildQuery({ status: f.value || undefined, page: "1" })}`}
                  className={`fp${active ? " on" : ""}`}
                >
                  {f.label}
                </Link>
              );
            })}
            <span className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)] self-center ml-1">Lead:</span>
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
                  className={`fp${active ? " on" : ""}`}
                >
                  {f.label}
                </Link>
              );
            })}
            <span className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)] self-center ml-1">Outcome:</span>
            {[
              { label: "All", value: "" },
              { label: "Sold", value: "sold" },
              { label: "Interested", value: "interested" },
              { label: "Not sold", value: "not_sold" },
            ].map((f) => {
              const active = (params.outcome ?? "") === f.value;
              return (
                <Link
                  key={f.label}
                  href={`/admin/bookings${buildQuery({ outcome: f.value || undefined, page: "1" })}`}
                  className={`fp${active ? " on" : ""}`}
                >
                  {f.label}
                </Link>
              );
            })}
            <form className="fs" style={{ flex: 1 }} action="/admin/bookings" method="get">
              {params.status && <input type="hidden" name="status" value={params.status} />}
              {params.leadTemperature && <input type="hidden" name="leadTemperature" value={params.leadTemperature} />}
              {params.outcome && <input type="hidden" name="outcome" value={params.outcome} />}
              {params.agentId && <input type="hidden" name="agentId" value={params.agentId} />}
              {params.missingAgent && <input type="hidden" name="missingAgent" value={params.missingAgent} />}
              <input
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Search by name, email, reference..."
                style={{ border: "none", outline: "none", background: "transparent", flex: 1, fontSize: "12.5px" }}
              />
            </form>
          </div>
          <form className="filters" style={{ borderTop: "none", paddingTop: 0 }} action="/admin/bookings" method="get">
            <select
              name="agentId"
              defaultValue={params.agentId ?? ""}
              className="border border-[var(--ops-border)] rounded-full px-3 py-2 text-xs bg-white focus:outline-none"
            >
              <option value="">All agents</option>
              {agentsForFilter.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <label className="fp" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" name="missingAgent" value="1" defaultChecked={params.missingAgent === "1"} />
              <span>Missing agent</span>
            </label>
            <button type="submit" className="btn sm">Apply</button>
            {(params.status || params.leadTemperature || params.outcome || params.missingAgent || params.agentId || params.q) && (
              <Link href="/admin/bookings" className="lnk">Clear</Link>
            )}
          </form>
        </div>

        {/* Table — desktop */}
        <div className="hidden lg:block card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="t">
              <thead>
                <tr>
                  <th>Booking Reference</th>
                  <th>Customer</th>
                  <th>Property</th>
                  <th>Inspection</th>
                  <th>Status</th>
                  <th>Lead</th>
                  <th>Agent</th>
                  <th>Outcome</th>
                  <th>Updated</th>
                  <th className="r">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((b) => (
                  <tr key={b.id} className="clk group">
                    <td>
                      <Link href={`/admin/bookings/${b.id}`} className="row-lead num font-medium text-[var(--ops-primary)] hover:underline group-hover:text-[var(--ops-deep)] whitespace-nowrap">
                        {b.ref}
                      </Link>
                      <small>{formatDate(b.createdAt)}</small>
                      {dupMap.has(b.id) && (
                        <div className="mt-1">
                          <span className="chip gold inline-flex items-center gap-1"><WarnIcon size={10} /> Duplicate</span>
                        </div>
                      )}
                    </td>
                    <td>
                      <b>{b.name}</b>
                      <small>{b.email}</small>
                      {b.phone && <small>{b.phone}</small>}
                    </td>
                    <td className="min-w-[240px]">
                      <b>
                        {b.estate ? `${b.estate}${b.unitType ? ` · ${b.unitType}` : ""}` : b.location}
                      </b>
                      {(b.plotCode || b.sqm) && (
                        <small>
                          {[b.plotCode, b.sqm ? `${b.sqm}sqm` : null].filter(Boolean).join(" · ")}
                        </small>
                      )}
                      {b.agentName && (
                        <small>Via {b.agentName}</small>
                      )}
                      {(b as any).selectionType === "unit" && (b as any).plotCode ? (
                        <span className="mt-1 inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">Unit selected · {(b as any).plotCode}</span>
                      ) : (b as any).selectionType === "sqm_needed" && (b as any).sqmNeeded ? (
                        <span className="mt-1 inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]">Sizing: {(b as any).sqmNeeded}sqm requested</span>
                      ) : (b as any).estate ? (
                        <span className="mt-1 inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap bg-white text-[#4B5563] border border-[#E5E7EB]">{(b as any).estate}</span>
                      ) : null}
                    </td>
                    <td>
                      {b.rescheduledDate ? (
                        <div>
                          <div className="text-[13px] font-medium text-[var(--ops-text)]">{formatDate(b.rescheduledDate)}</div>
                          <div className="text-[11px] text-[var(--ops-muted)]">{b.rescheduledTime}</div>
                          <span className="inline-flex mt-1 px-1.5 py-0.5 rounded-full text-[10px] bg-transparent text-[#1E3A5F] border border-[#C7D2E0]">Rescheduled</span>
                          <InspectionTiming date={b.rescheduledDate} />
                        </div>
                      ) : (
                        <div>
                          <div className="text-[13px] text-[var(--ops-text)]">{formatDate(b.preferredDate)}</div>
                          <div className="text-[11px] text-[var(--ops-muted)]">{b.preferredTime}</div>
                          <InspectionTiming date={b.preferredDate} />
                        </div>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={b.status === "closed" && b.outcome ? "closed" : b.status} />{b.status === "closed" && b.outcome ? <span className="ml-1"><StatusBadge status={b.outcome} /></span> : null}
                    </td>
                    <td>
                      <StatusBadge status={b.leadTemperature} />
                    </td>
                    <td>
                      <AgentCell agent={(b as any).agent} customerEmail={b.email} customerPhone={b.phone} />
                    </td>
                    <td>
                      {b.outcome ? (
                        <StatusBadge status={b.outcome} />
                      ) : (
                        <span className="text-[12px] text-[var(--ops-muted)]">-</span>
                      )}
                    </td>
                    <td className="mono text-[11px] text-[var(--ops-muted)] whitespace-nowrap">{formatDate(b.updatedAt)}</td>
                    <td className="r">
                      <Link href={`/admin/bookings/${b.id}`} className="btn sm">
                        View
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 18l6-6-6-6"/></svg>
                      </Link>
                    </td>
                  </tr>
                ))}
                {bookings.length === 0 && (
                  <tr>
                    <td colSpan={10}><div className="empty">No bookings match these filters. Try adjusting your filters or search terms, or create a new booking.</div></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="lg:hidden space-y-3 mt-4">
          {sorted.map((b) => (
            <AdminListCard
              key={b.id}
              href={`/admin/bookings/${b.id}`}
              refText={b.ref}
              refNoWrap
              name={b.name}
              email={b.email}
              badges={
                <>
                  <StatusBadge status={b.status} />
                  <StatusBadge status={b.leadTemperature} />
                </>
              }
              rows={[
                { label: "Property", value: b.location },
                {
                  label: "Inspection",
                  value: `${b.rescheduledDate ? formatDate(b.rescheduledDate) : formatDate(b.preferredDate)} · ${b.rescheduledTime ?? b.preferredTime}`,
                },
                {
                  label: "Agent",
                  value: <AgentCell agent={(b as any).agent} customerEmail={b.email} customerPhone={b.phone} />,
                },
                {
                  label: "Outcome",
                  value: b.outcome ? (
                    <StatusBadge status={b.outcome} />
                  ) : (
                    <span className="text-[var(--ops-muted)]">-</span>
                  ),
                },
              ]}
            />
          ))}
          {bookings.length === 0 && (
            <div className="bg-white border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-8 text-center">
              <p className="text-sm text-[var(--ops-muted)]">No bookings found.</p>
            </div>
          )}
        </div>

        <AdminPagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} basePath="/admin/bookings" query={paginationQuery} />
      </div>
    </div>
  );
}
