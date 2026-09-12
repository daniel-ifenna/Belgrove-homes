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
      <div className="flex items-center gap-2">
        <span className="h-7 w-7 rounded-full bg-[var(--forest-800)] text-white grid place-items-center text-[10px] font-medium shrink-0">
          {agent.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-[var(--ink)] leading-none">{agent.name}</span>
          <span className={`mt-1 inline-flex w-fit px-2 py-0.5 rounded-full text-[10px] leading-none ${agent.category === "staff" ? "bg-[var(--forest-800)] text-white" : "bg-[var(--gold-600)] text-white"}`}>
            {agent.category === "hire_purchase" ? "Hire Purchase" : "Staff"}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="h-7 w-7 rounded-full border border-dashed border-[var(--line)] bg-[var(--cream)] grid place-items-center text-[10px] text-[var(--ink-muted)]"></span>
      <span className="inline-flex items-center gap-2">
        <span className="px-2 py-1 rounded-full text-xs bg-white border border-[var(--line)] text-[var(--ink-muted)]">Unassigned</span>
        <span className="text-xs text-[var(--gold-600)]">· Assign</span>
      </span>
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
    // if q looks like exact ref, also check ref equality is covered
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

  // Duplicate detection: same phone/email within 3 days of inspection date, excluding closed, max window compute for current page
  // Fetch all non-closed bookings for duplicate compare (lightweight)
  const nonClosed = await prisma.inspectionBooking.findMany({
    where: { status: { not: "closed" } },
    select: { id: true, email: true, phone: true, preferredDate: true, rescheduledDate: true },
  });
  const dupMap = new Map<string, string[]>(); // bookingId -> duplicateIds
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

  // For consistent ordering: missing agent first when no explicit filter/sort
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

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl tracking-tight text-[var(--ink)]">Inspection Bookings</h1>
          <p className="text-sm text-[var(--ink-muted)] mt-1">{total} bookings · Page {page} of {totalPages}</p>
        </div>
        <a
          href={`/api/admin/bookings/export${buildQuery({ page: undefined })}`}
          className="text-sm border border-[var(--line)] bg-white rounded-full px-4 py-2 hover:bg-[var(--cream)]"
        >
          Export PDF
        </a>
      </div>

      <form className="flex flex-wrap gap-3 mb-4" action="/admin/bookings" method="get">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search ref, name, phone, email"
          className="border border-[var(--line)] bg-white rounded-full px-4 py-2 text-sm min-w-[240px] focus:outline-none focus:ring-2 focus:ring-[var(--forest-600)]"
        />
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="border border-[var(--line)] rounded-full px-3 py-2 text-sm bg-white"
        >
          <option value="">All statuses</option>
          {allStatuses.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>

        <select
          name="leadTemperature"
          defaultValue={params.leadTemperature ?? ""}
          className="border border-[var(--line)] rounded-full px-3 py-2 text-sm bg-white"
        >
          <option value="">All temperatures</option>
          {allTemperatures.map((t) => (
            <option key={t} value={t}>
              {t[0].toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>

        <select
          name="agentId"
          defaultValue={params.agentId ?? ""}
          className="border border-[var(--line)] rounded-full px-3 py-2 text-sm bg-white"
        >
          <option value="">All agents</option>
          {agentsForFilter.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} {a.category === "hire_purchase" ? "Hire Purchase" : "Staff"}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm border border-[var(--line)] rounded-full px-3 py-2 bg-white">
          <input
            type="checkbox"
            name="missingAgent"
            value="1"
            defaultChecked={params.missingAgent === "1"}
          />
          Missing agent
        </label>

        <button type="submit" className="text-sm bg-[var(--forest-800)] text-white rounded-full px-5 py-2 font-medium hover:bg-[var(--forest-600)]">
          Filter
        </button>
        {(params.status || params.leadTemperature || params.missingAgent || params.agentId || params.q) && (
          <Link href="/admin/bookings" className="text-sm text-[var(--ink-muted)] self-center underline underline-offset-4">
            Clear
          </Link>
        )}
      </form>

      <div className="bg-[var(--cream-elevated)] border border-[var(--line)] rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-[var(--ink-muted)] bg-[var(--cream)]/60">
              <th className="px-4 py-3 font-medium">Ref</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Date &amp; time</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Agent</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Lead</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((b) => (
              <tr key={b.id} className="border-b border-[var(--line)]/60 last:border-0 hover:bg-[var(--cream)]/40">
                <td className="px-4 py-3">
                  <Link href={`/admin/bookings/${b.id}`} className="font-mono text-xs text-[var(--forest-800)] hover:underline">
                    {b.ref}
                  </Link>
                  {dupMap.has(b.id) && (
                    <div className="mt-1">
                      <Link href={`/admin/bookings/${dupMap.get(b.id)![0]}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-amber-50 text-amber-800 border border-amber-200">
                        ⚠ Possible duplicate
                      </Link>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--ink)]">{b.name}</td>
                <td className="px-4 py-3 text-[var(--ink-muted)]">
                  {b.rescheduledDate ? (
                    <>
                      <div>{formatDate(b.rescheduledDate)} at {b.rescheduledTime}</div>
                      <div className="text-xs text-[var(--plum-600)]">rescheduled</div>
                    </>
                  ) : (
                    <div>
                      {formatDate(b.preferredDate)} at {b.preferredTime}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--ink-muted)] max-w-[200px] truncate">{b.location}</td>
                <td className="px-4 py-3">
                  <Link href={`/admin/bookings/${b.id}`}>
                    <AgentCell agent={(b as any).agent} />
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[b.status]}`}>
                    {statusLabels[b.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${temperatureColors[b.leadTemperature]}`}>
                    {b.leadTemperature}
                  </span>
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[var(--ink-muted)]">
                  No bookings match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-[var(--ink-muted)]">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/bookings${buildQuery({ page: String(page - 1) })}`}
                className="border border-[var(--line)] bg-white rounded-full px-4 py-1.5 hover:bg-[var(--cream)]"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/bookings${buildQuery({ page: String(page + 1) })}`}
                className="bg-[var(--forest-800)] text-white rounded-full px-4 py-1.5 hover:bg-[var(--forest-600)]"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
