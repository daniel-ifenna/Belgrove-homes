import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { redirect } from "next/navigation";
import { formatNaira, formatCompactNaira } from "@/lib/currency";
import { statusColors, statusLabels } from "@/lib/booking-ui";
import { excludeTestRows, excludeTestTransactions } from "@/lib/test-data";
import { getCollectedRevenue, getMonthlyTargetProgress, getOverdueInstallments, getRevenueSparkline } from "@/lib/finance";

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

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) redirect("/admin/login");

  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * DAY);
  const d60 = new Date(now.getTime() - 60 * DAY);

  // Test fixtures (isTest) never appear in metrics or queues. Receipts
  // inherit test status from their transaction; installments from theirs.
  // Money figures come from the finance service (rule 3) — never ad-hoc sums.
  const realTx = excludeTestRows(false);
  const realBooking = excludeTestRows(false);
  const realReceipt = excludeTestTransactions(false);
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
    recentBookings,
    recentTx,
    overdue,
    unassignedCount,
    awaitingCount,
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
    getCollectedRevenue({ from: d30 }),
    getCollectedRevenue({ from: d60, to: d30 }),
    getMonthlyTargetProgress(now),
    prisma.inspectionBooking.findMany({
      where: realBooking,
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, ref: true, name: true, status: true, updatedAt: true },
    }),
    prisma.transaction.findMany({
      where: realTx,
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, ref: true, customerName: true, estate: true, status: true, updatedAt: true },
    }),
    getOverdueInstallments(),
    prisma.inspectionBooking.count({ where: { ...realBooking, agentId: null, status: { not: "closed" } } }),
    prisma.inspectionBooking.count({ where: { ...realBooking, status: "active" } }),
    getRevenueSparkline(14),
  ]);

  const soldSum = target.collected;
  const goal = target.goal;
  const pct = target.pct;
  const overdueCount = overdue.length;
  const days = sparkDays;
  const maxDay = Math.max(1, ...days);
  const sparkPoints = days
    .map((v, i) => `${(i / 13) * 100},${28 - (v / maxDay) * 24}`)
    .join(" ");

  type FeedItem = {
    kind: "booking" | "transaction";
    id: string;
    ref: string;
    customer: string;
    detail: string;
    statusLabel: string;
    statusClass: string;
    href: string;
    at: Date;
  };
  const txBadge = (s: string) =>
    s === "PAID_IN_FULL"
      ? "bg-[#16281D] text-white border-[#16281D]"
      : s === "ACTIVE"
        ? "bg-[#1F6B3E] text-white border-[#1F6B3E]"
        : "bg-transparent text-[#6B6252] border-[#D8CFC0]";
  const feed: FeedItem[] = [
    ...recentBookings.map((b) => ({
      kind: "booking" as const,
      id: b.id,
      ref: b.ref,
      customer: b.name,
      detail: "Inspection booking",
      statusLabel: statusLabels[b.status] ?? b.status,
      statusClass: statusColors[b.status] ?? "",
      href: `/admin/bookings/${b.id}`,
      at: b.updatedAt,
    })),
    ...recentTx.map((t) => ({
      kind: "transaction" as const,
      id: t.id,
      ref: t.ref,
      customer: t.customerName,
      detail: t.estate,
      statusLabel: t.status.replace("_", " "),
      statusClass: txBadge(t.status),
      href: `/admin/transactions/${t.id}`,
      at: t.updatedAt,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8);

  const attention = [
    {
      label: "Overdue payments",
      count: overdueCount,
      hint: "installments past due",
      href: "/admin/transactions",
      tone: overdueCount > 0 ? "text-[#A6402F]" : "text-[var(--ops-muted)]",
      dot: overdueCount > 0 ? "bg-[#A6402F]" : "bg-[var(--ops-border)]",
    },
    {
      label: "Unassigned bookings",
      count: unassignedCount,
      hint: "no agent yet",
      href: "/admin/bookings?missingAgent=1",
      tone: unassignedCount > 0 ? "text-[#8B6B1F]" : "text-[var(--ops-muted)]",
      dot: unassignedCount > 0 ? "bg-[#C89B3C]" : "bg-[var(--ops-border)]",
    },
    {
      label: "Awaiting outcome",
      count: awaitingCount,
      hint: "inspections held",
      href: "/admin/inspections",
      tone: awaitingCount > 0 ? "text-[#1F6B3E]" : "text-[var(--ops-muted)]",
      dot: awaitingCount > 0 ? "bg-[#1F6B3E]" : "bg-[var(--ops-border)]",
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--ops-bg)]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6">
        <div className="mb-6">
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
          {/* Recent activity */}
          <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] overflow-hidden shadow-[var(--ops-shadow-sm)]">
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <h2 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">
                Recent activity
              </h2>
              <Link href="/admin/bookings" className="mono text-[11px] text-[var(--ops-primary)] hover:underline underline-offset-4">
                All bookings →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm admin-table">
                <thead>
                  <tr className="border-b border-[var(--border-hairline)] text-left">
                    <th className="px-5 py-2.5 mono text-[11px] tracking-[0.08em] uppercase font-medium text-[var(--text-body)]">Reference</th>
                    <th className="px-4 py-2.5 mono text-[11px] tracking-[0.08em] uppercase font-medium text-[var(--text-body)]">Customer</th>
                    <th className="px-4 py-2.5 mono text-[11px] tracking-[0.08em] uppercase font-medium text-[var(--text-body)]">Status</th>
                    <th className="px-4 py-2.5 mono text-[11px] tracking-[0.08em] uppercase font-medium text-[var(--text-body)]">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ops-border)]/60">
                  {feed.map((f) => (
                    <tr key={`${f.kind}-${f.id}`} className="hover:bg-[rgba(28,43,32,0.03)] transition-colors">
                      <td className="px-5">
                        <Link href={f.href} className="row-lead font-mono text-[12px] font-medium text-[var(--ops-primary)] hover:underline">
                          {f.ref}
                        </Link>
                        <div className="mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)] mt-0.5">{f.kind}</div>
                      </td>
                      <td className="px-4">
                        <div className="text-[13px] font-medium text-[var(--ops-text)] leading-tight break-all">{f.customer}</div>
                        <div className="text-[12px] text-[var(--ops-muted)] break-all">{f.detail}</div>
                      </td>
                      <td className="px-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium border ${f.statusClass}`}>
                          {f.statusLabel}
                        </span>
                      </td>
                      <td className="px-4 mono text-[11px] text-[var(--ops-muted)]">
                        {f.at.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                      </td>
                    </tr>
                  ))}
                  {feed.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-12 text-center">
                        <p className="public text-[14px] text-[var(--ops-muted)]">No activity yet — bookings and transactions will appear here.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right stack: target + attention */}
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

            <div className="bg-white border border-[var(--border-hairline)] rounded-[var(--ops-radius)] p-5 shadow-[var(--shadow-sm)]">
              <div className="mono text-[11px] tracking-[0.08em] uppercase text-[var(--ops-muted)]">Needs attention</div>
              <div className="mt-3 divide-y divide-[var(--ops-border)]/60">
                {attention.map((a) => (
                  <Link key={a.label} href={a.href} className="flex items-center gap-3 py-3 group">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${a.dot}`} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-medium text-[var(--ops-text)] group-hover:underline underline-offset-4">{a.label}</span>
                      <span className="block mono text-[10px] tracking-wide uppercase text-[var(--ops-muted)]">{a.hint}</span>
                    </span>
                    <span className={`font-mono text-[15px] font-medium ${a.tone}`}>{a.count}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-[var(--ops-muted)] group-hover:text-[var(--ops-text)] transition-colors"><path d="M9 18l6-6-6-6" /></svg>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
