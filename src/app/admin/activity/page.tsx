import Link from "next/link";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { redirect } from "next/navigation";
import { getActivityFeed } from "@/lib/activity";
import { formatLagos } from "@/lib/time";
import AdminPagination from "@/components/admin/AdminPagination";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SearchParams = { entityType?: string; actor?: string; from?: string; to?: string; q?: string; page?: string };

const ENTITY_TYPES = ["", "booking", "transaction", "payment", "receipt"];

export default async function ActivityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) redirect("/admin/login");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const from = params.from ? new Date(params.from) : undefined;
  const to = params.to ? new Date(params.to + "T23:59:59") : undefined;

  const rows = await getActivityFeed({
    entityType: params.entityType || undefined,
    actor: params.actor || undefined,
    from: from && !Number.isNaN(from.getTime()) ? from : undefined,
    to: to && !Number.isNaN(to.getTime()) ? to : undefined,
    ref: params.q || undefined,
    take: page * PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const paginationQuery = (() => {
    const qs = new URLSearchParams();
    if (params.entityType) qs.set("entityType", params.entityType);
    if (params.actor) qs.set("actor", params.actor);
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    if (params.q) qs.set("q", params.q);
    return qs.toString();
  })();

  return (
    <div className="min-h-screen bg-[var(--ops-bg)]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="font-serif text-[28px] lg:text-[32px] tracking-[-0.02em] text-[var(--ops-text)] leading-none">Activity</h1>
          <p className="public text-[13px] leading-[1.5] text-[var(--ops-muted)] mt-2">
            Read-only audit history: every booking action and payment, transaction and receipt change.
          </p>
        </div>

        <form className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-4 shadow-[var(--ops-shadow-sm)] mb-4 flex flex-wrap gap-2 items-end" action="/admin/activity" method="get">
          <div>
            <label className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">Type</label>
            <select name="entityType" defaultValue={params.entityType ?? ""} className="mt-1 block border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm bg-white">
              <option value="">All types</option>
              {ENTITY_TYPES.filter(Boolean).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">Actor</label>
            <input name="actor" defaultValue={params.actor ?? ""} placeholder="Name…" className="mt-1 block border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm bg-white" />
          </div>
          <div>
            <label className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">From</label>
            <input type="date" name="from" defaultValue={params.from ?? ""} className="mt-1 block border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm bg-white" />
          </div>
          <div>
            <label className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">To</label>
            <input type="date" name="to" defaultValue={params.to ?? ""} className="mt-1 block border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm bg-white" />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">Reference</label>
            <input name="q" defaultValue={params.q ?? ""} placeholder="BKG-… / TXN-… / PAY-… / RCT-…" className="mt-1 block w-full border border-[var(--ops-border)] rounded-xl px-3 py-2 text-sm bg-white" />
          </div>
          <button type="submit" className="text-xs bg-[var(--ops-primary)] text-white rounded-full px-4 py-2 font-medium">Filter</button>
          {(params.entityType || params.actor || params.from || params.to || params.q) && (
            <Link href="/admin/activity" className="text-xs text-[var(--ops-muted)] underline underline-offset-4 self-center">Clear</Link>
          )}
        </form>

        <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] overflow-hidden shadow-[var(--ops-shadow-sm)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm admin-table">
              <thead>
                <tr className="border-b border-[var(--border-hairline)] text-left">
                  <th className="px-5 py-2.5 mono text-[11px] tracking-[0.08em] uppercase font-medium text-[var(--text-body)]">When</th>
                  <th className="px-4 py-2.5 mono text-[11px] tracking-[0.08em] uppercase font-medium text-[var(--text-body)]">Actor</th>
                  <th className="px-4 py-2.5 mono text-[11px] tracking-[0.08em] uppercase font-medium text-[var(--text-body)]">Action</th>
                  <th className="px-4 py-2.5 mono text-[11px] tracking-[0.08em] uppercase font-medium text-[var(--text-body)]">Entity</th>
                  <th className="px-4 py-2.5 mono text-[11px] tracking-[0.08em] uppercase font-medium text-[var(--text-body)]">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ops-border)]/60">
                {visible.map((r) => (
                  <tr key={r.id} className="hover:bg-[rgba(28,43,32,0.03)] transition-colors">
                    <td className="px-5 mono text-[11px] text-[var(--ops-muted)] whitespace-nowrap">{formatLagos(r.at, "datetime")}</td>
                    <td className="px-4 text-[13px]">{r.actor}</td>
                    <td className="px-4"><span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border bg-transparent text-[#6B6252] border-[#D8CFC0]">{r.action}</span></td>
                    <td className="px-4">
                      <Link href={r.href} className="font-mono text-[12px] text-[var(--ops-primary)] hover:underline">{r.entityRef}</Link>
                      <div className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">{r.entityType}</div>
                    </td>
                    <td className="px-4 text-[12px] text-[var(--ops-muted)] break-words max-w-[320px]">{r.detail ?? "-"}</td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center">
                      <p className="public text-[14px] text-[var(--ops-muted)]">No activity matches these filters.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="mt-4">
          <AdminPagination page={page} totalPages={totalPages} total={rows.length} pageSize={PAGE_SIZE} basePath="/admin/activity" query={paginationQuery} />
        </div>
        <div className="mt-2 mono text-[10px] text-[var(--ops-muted)]">Server-side paging over the latest {rows.length} events. Narrow with filters for older history.</div>
      </div>
    </div>
  );
}
