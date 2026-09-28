import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { redirect } from "next/navigation";
import { formatNaira, formatCompactNaira } from "@/lib/currency";
import { excludeTestRows } from "@/lib/test-data";
import { getCollectedRevenue, getOverdueInstallments, getPendingVerification } from "@/lib/finance";
import { getActionCounts, getActionItems, INBOX_CATEGORIES } from "@/lib/inbox";
import { lagosMonthRange } from "@/lib/time";
import TestDataToggle from "@/components/admin/TestDataToggle";
import TrendChip from "@/components/admin/TrendChip";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

function StatCard({
  label,
  figure,
  cur,
  prev,
  context,
  icon,
}: {
  label: string;
  figure: string;
  cur?: number;
  prev?: number;
  context: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-[var(--border-hairline)] rounded-[var(--ops-radius)] p-5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-shadow">
      <div className="flex items-center gap-3">
        <span className="h-10 w-10 rounded-[10px] bg-[var(--accent-gold)]/10 text-[var(--accent-gold)] grid place-items-center shrink-0">
          {icon}
        </span>
        <span className="mono text-[11px] tracking-[0.08em] uppercase text-[var(--ops-muted)]">{label}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2 flex-wrap">
        <span className="font-serif text-[32px] leading-none text-[var(--ops-text)] price">{figure}</span>
        {cur !== undefined && prev !== undefined && <TrendChip cur={cur} prev={prev} />}
      </div>
      <div className="public text-[12px] text-[var(--ops-muted)] mt-1.5">{context}</div>
    </div>
  );
}

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<{ showTest?: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) redirect("/admin/login");
  const showTest = (await searchParams).showTest === "1";

  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * DAY);
  const d60 = new Date(now.getTime() - 60 * DAY);

  // Test fixtures hidden by default; ?showTest=1 reveals them in metrics too.
  // Money figures always come from the finance service (rule 3).
  const testOpts = { includeTest: showTest };
  const realTx = excludeTestRows(showTest);
  const realBooking = excludeTestRows(showTest);
  const prevMonthRange = lagosMonthRange(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const monthRange = lagosMonthRange(now);
  const [
    totalBookings,
    activeTx,
    newTx30,
    newTxPrior,
    soldSum,
    priorMonthCollected,
    pending,
    overdueList,
    actionItems,
    actionCounts,
  ] = await Promise.all([
    prisma.inspectionBooking.count({ where: realBooking }),
    prisma.transaction.count({ where: { ...realTx, status: "ACTIVE" } }),
    prisma.transaction.count({ where: { ...realTx, createdAt: { gte: d30 } } }),
    prisma.transaction.count({ where: { ...realTx, createdAt: { gte: d60, lt: d30 } } }),
    getCollectedRevenue({ from: monthRange.start, to: monthRange.end, ...testOpts }),
    getCollectedRevenue({ from: prevMonthRange.start, to: prevMonthRange.end, ...testOpts }),
    getPendingVerification(undefined, testOpts),
    getOverdueInstallments(undefined, undefined, testOpts),
    getActionItems({ includeTest: showTest, now }),
    getActionCounts({ includeTest: showTest }),
  ]);

  const overdueTotal = overdueList.reduce((s, o) => s + (o.scheduledAmount - o.confirmedPaid), 0);

  // Needs-action groups in priority order; top items inline, rest via inbox.
  const groups = INBOX_CATEGORIES.map((c) => ({
    ...c,
    count: actionCounts.byCategory[c.category],
    items: actionItems.filter((i) => i.category === c.category).slice(0, 2),
  })).filter((g) => g.count > 0);
  const topItems = actionItems.slice(0, 6);

  return (
    <div className="min-h-screen bg-[var(--ops-bg)]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6">
        <div className="mb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
          <h1 className="font-serif text-[28px] lg:text-[32px] tracking-[-0.02em] text-[var(--ops-text)] leading-none">
            Dashboard
          </h1>
          <p className="public text-[13px] leading-[1.5] text-[var(--ops-muted)] mt-2">
            The ledger at a glance — bookings, sales, receipts and what needs you today.
          </p>
          <p className="mono text-[11px] tracking-wide uppercase text-[var(--ops-muted)] mt-1">
            {totalBookings} bookings all time
          </p>
          </div>
          <TestDataToggle href={showTest ? "/admin" : "/admin?showTest=1"} showing={showTest} />
        </div>

        {/* Stat cards */}
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Collected this month"
            figure={formatCompactNaira(soldSum)}
            cur={soldSum}
            prev={priorMonthCollected}
            context="Confirmed payments vs prior month"
            icon={
              <svg {...iconProps}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
            }
          />
          <StatCard
            label="Pending verification"
            figure={pending.count.toLocaleString("en-NG")}
            context={formatNaira(pending.total)}
            icon={
              <svg {...iconProps}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
            }
          />
          <StatCard
            label="Overdue"
            figure={overdueList.length.toLocaleString("en-NG")}
            context={formatNaira(overdueTotal)}
            icon={
              <svg {...iconProps}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
            }
          />
          <StatCard
            label="Active Transactions"
            figure={activeTx.toLocaleString("en-NG")}
            cur={newTx30}
            prev={newTxPrior}
            context="new transactions vs. prior 30 days"
            icon={
              <svg {...iconProps}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>
            }
          />
        </div>

        <div className="mt-4">
          {/* Needs action — live work queue, clears itself as items resolve */}
          <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] overflow-hidden shadow-[var(--ops-shadow-sm)]">
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <h2 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">
                Needs action{actionCounts.total > 0 ? ` · ${actionCounts.total}` : ""}
              </h2>
              <Link href="/admin/inbox" className="mono text-[11px] text-[var(--ops-primary)] hover:underline underline-offset-4">
                View all →
              </Link>
            </div>
            {topItems.length === 0 ? (
              <p className="public text-[14px] text-[var(--ops-muted)] px-5 py-12 text-center">You&apos;re all caught up.</p>
            ) : (
              <div className="divide-y divide-[var(--ops-border)]/60">
                {topItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[rgba(28,43,32,0.03)] transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <Link href={item.href} className="row-lead font-mono text-[12px] font-medium text-[var(--ops-primary)] hover:underline">
                          {item.ref}
                        </Link>
                        <span className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">{item.age}</span>
                      </div>
                      <div className="text-[13px] font-medium text-[var(--ops-text)] leading-tight break-all">{item.title}</div>
                      <div className="text-[12px] text-[var(--ops-muted)] break-all">{item.subtitle}</div>
                    </div>
                    <Link href={item.href} className="shrink-0 mono text-[11px] bg-[var(--ops-primary)] text-white rounded-full px-3.5 py-1.5 font-medium hover:bg-[var(--ops-deep)] transition-colors">
                      {item.actionLabel}
                    </Link>
                  </div>
                ))}
              </div>
            )}
            {groups.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-5 py-3 border-t border-[var(--ops-border)]/60">
                {groups.map((g) => (
                  <Link key={g.category} href={`/admin/inbox?category=${g.category}`} className="px-2.5 py-1 rounded-full text-[11px] font-medium border bg-white border-[var(--ops-border)] text-[var(--ops-muted)] hover:border-[var(--ops-border-strong)]">
                    {g.label} · {g.count}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
