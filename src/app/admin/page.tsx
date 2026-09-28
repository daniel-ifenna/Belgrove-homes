import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { redirect } from "next/navigation";
import { formatNaira, formatCompactNaira } from "@/lib/currency";
import { excludeTestRows, excludeTestTransactions } from "@/lib/test-data";
import { getCollectedRevenue, getMonthlyTargetProgress, getRevenueSparkline } from "@/lib/finance";
import { getActionCounts, getActionItems, INBOX_CATEGORIES } from "@/lib/inbox";
import TestDataToggle from "@/components/admin/TestDataToggle";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

function pctChange(cur: number, prev: number): number | null {
  if (prev > 0) return Math.round(((cur - prev) / prev) * 100);
  if (cur > 0) return 100;
  return 0;
}

function TrendChip({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) {
    return (
      <span className="fraunces italic text-[13px] text-[var(--ops-muted)]">— 0%</span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={`fraunces italic text-[13px] ${up ? "text-[#1F6B3E]" : "text-[#A6402F]"}`}
    >
      {up ? "▲" : "▼"} {Math.abs(delta)}%
    </span>
  );
}

function StatCard({
  label,
  figure,
  delta,
  context,
  icon,
}: {
  label: string;
  figure: string;
  delta: number | null;
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
        <TrendChip delta={delta} />
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
  const realReceipt = excludeTestTransactions(showTest);
  const [
    totalBookings,
    bookings30,
    bookingsPrior,
    activeTx,
    newTx30,
    newTxPrior,
    receipts30,
    receiptsPrior,
    revenue30Sum,
    revenuePriorSum,
    target,
    actionItems,
    actionCounts,
    sparkDays,
  ] = await Promise.all([
    prisma.inspectionBooking.count({ where: realBooking }),
    prisma.inspectionBooking.count({ where: { ...realBooking, createdAt: { gte: d30 } } }),
    prisma.inspectionBooking.count({ where: { ...realBooking, createdAt: { gte: d60, lt: d30 } } }),
    prisma.transaction.count({ where: { ...realTx, status: "ACTIVE" } }),
    prisma.transaction.count({ where: { ...realTx, createdAt: { gte: d30 } } }),
    prisma.transaction.count({ where: { ...realTx, createdAt: { gte: d60, lt: d30 } } }),
    prisma.receipt.count({ where: { ...realReceipt, issuedAt: { gte: d30 }, status: { in: ["sent", "generated"] } } }),
    prisma.receipt.count({ where: { ...realReceipt, issuedAt: { gte: d60, lt: d30 }, status: { in: ["sent", "generated"] } } }),
    getCollectedRevenue({ from: d30, ...testOpts }),
    getCollectedRevenue({ from: d60, to: d30, ...testOpts }),
    getMonthlyTargetProgress(now, undefined, testOpts),
    getActionItems({ includeTest: showTest, now }),
    getActionCounts({ includeTest: showTest }),
    getRevenueSparkline(14, undefined, undefined, testOpts),
  ]);

  const soldSum = target.collected;
  const goal = target.goal;
  const pct = target.pct;
  const days = sparkDays;
  const maxDay = Math.max(1, ...days);
  const sparkPoints = days
    .map((v, i) => `${(i / 13) * 100},${28 - (v / maxDay) * 24}`)
    .join(" ");

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
            label="Total Bookings"
            figure={totalBookings.toLocaleString("en-NG")}
            delta={pctChange(bookings30, bookingsPrior)}
            context="vs. prior 30 days"
            icon={
              <svg {...iconProps}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" /></svg>
            }
          />
          <StatCard
            label="Active Transactions"
            figure={activeTx.toLocaleString("en-NG")}
            delta={pctChange(newTx30, newTxPrior)}
            context="new transactions vs. prior 30 days"
            icon={
              <svg {...iconProps}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>
            }
          />
          <StatCard
            label="Receipts Issued · 30d"
            figure={receipts30.toLocaleString("en-NG")}
            delta={pctChange(receipts30, receiptsPrior)}
            context="vs. prior 30 days"
            icon={
              <svg {...iconProps}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
            }
          />
          <StatCard
            label="Revenue Collected · 30d"
            figure={formatCompactNaira(revenue30Sum)}
            delta={pctChange(revenue30Sum, revenuePriorSum)}
            context={`${formatNaira(revenue30Sum)} · vs. prior 30 days`}
            icon={
              <svg {...iconProps}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
            }
          />
        </div>

        <div className="mt-4 grid lg:grid-cols-[1.85fr_1fr] gap-4 items-start">
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

          {/* Right stack: target only (attention merged into Needs action) */}
          <div className="space-y-4">
            <div className="bg-white border border-[var(--border-hairline)] rounded-[var(--ops-radius)] p-5 shadow-[var(--shadow-sm)]">
              <div className="mono text-[11px] tracking-[0.08em] uppercase text-[var(--ops-muted)]">Monthly target</div>
              <div className="mt-2 font-mono text-[20px] font-medium text-[var(--ops-text)] price">
                {formatCompactNaira(soldSum)}{" "}
                <span className="text-[13px] font-normal text-[var(--ops-muted)]">of {formatCompactNaira(goal)}</span>
              </div>
              <svg viewBox="0 0 100 28" className="mt-3 w-full h-[36px]" preserveAspectRatio="none" aria-hidden="true">
                <polyline
                  points={sparkPoints}
                  fill="none"
                  stroke="var(--accent-gold)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <div className="mt-1 flex items-center justify-end">
                <span className="mono text-[11px] text-[var(--ops-muted)]">{pct}%</span>
              </div>
              <div className="mt-1.5 h-[6px] rounded-full bg-[rgba(28,43,32,0.08)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--accent-gold)]" style={{ width: `${pct}%` }} />
              </div>
              <div className="public text-[12px] text-[var(--ops-muted)] mt-2">Receipted sales this month · last 14 days above</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
