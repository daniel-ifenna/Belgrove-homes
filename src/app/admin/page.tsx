import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { redirect } from "next/navigation";
import { formatNaira, formatCompactNaira } from "@/lib/currency";
import { excludeTestRows } from "@/lib/test-data";
import { getCollectedRevenue, getOverdueInstallments, getPendingVerification } from "@/lib/finance";
import { getActionItems } from "@/lib/inbox";
import { lagosMonthRange } from "@/lib/time";
import { formatDate } from "@/lib/booking-ui";
import { trendFor } from "@/components/admin/TrendChip";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  figure,
  cur,
  prev,
  context,
  icon,
  red = false,
}: {
  label: string;
  figure: string;
  cur?: number;
  prev?: number;
  context: string;
  icon: React.ReactNode;
  red?: boolean;
}) {
  const trend = cur !== undefined && prev !== undefined ? trendFor(cur, prev) : null;
  return (
    <div className={`card kpi${red ? " red" : ""}`}>
      <div className="ki">{icon}</div>
      <small>{label}</small>
      <div className="v">
        {figure}
        {trend && trend.kind !== "flat" && (
          <em>{trend.kind === "new" ? "New" : `${trend.kind === "up" ? "▲" : "▼"} ${trend.pct}%`}</em>
        )}
      </div>
      <p>{context}</p>
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

  // Test fixtures hidden by default; ?showTest=1 reveals them in metrics too.
  // Money figures always come from the finance service (rule 3).
  const testOpts = { includeTest: showTest };
  const realTx = excludeTestRows(showTest);
  const prevMonthRange = lagosMonthRange(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const monthRange = lagosMonthRange(now);
  const [
    activeTx,
    paidInFull,
    soldSum,
    priorMonthCollected,
    pending,
    overdueList,
    actionItems,
    latestPayments,
  ] = await Promise.all([
    prisma.transaction.count({ where: { ...realTx, status: "ACTIVE" } }),
    prisma.transaction.count({ where: { ...realTx, status: "PAID_IN_FULL" } }),
    getCollectedRevenue({ from: monthRange.start, to: monthRange.end, ...testOpts }),
    getCollectedRevenue({ from: prevMonthRange.start, to: prevMonthRange.end, ...testOpts }),
    getPendingVerification(undefined, testOpts),
    getOverdueInstallments(undefined, undefined, testOpts),
    getActionItems({ includeTest: showTest, now }),
    prisma.payment.findMany({
      where: { status: "CONFIRMED", ...(showTest ? {} : { transaction: { isTest: false } }) },
      orderBy: { paymentDate: "desc" },
      take: 4,
      select: {
        amount: true,
        paymentDate: true,
        paymentMethod: true,
        transaction: { select: { customerName: true } },
      },
    }),
  ]);

  const overdueTotal = overdueList.reduce((s, o) => s + (o.scheduledAmount - o.confirmedPaid), 0);

  // Needs-action queue inline; the rest lives in the inbox.
  const topItems = actionItems.slice(0, 6);

  return (
    <div className="min-h-screen bg-[var(--ops-bg)]">
      <div className="max-w-[1180px] mx-auto px-6 lg:px-7 py-6">
        <div className="ph">
          <div>
            <h1>Dashboard</h1>
            <p>What needs you today.</p>
          </div>
        </div>

        <div className="kpis">
          <StatCard
            label="Collected this month"
            figure={formatCompactNaira(soldSum)}
            cur={soldSum}
            prev={priorMonthCollected}
            context="Confirmed payments vs last month"
            icon={
              <svg {...iconProps}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
            }
          />
          <StatCard
            label="Awaiting bank check"
            figure={pending.count.toLocaleString("en-NG")}
            context={`${formatNaira(pending.total)} to verify`}
            icon={
              <svg {...iconProps}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>
            }
          />
          <StatCard
            label="Overdue"
            figure={overdueList.length.toLocaleString("en-NG")}
            context={`${formatNaira(overdueTotal)} behind schedule`}
            red
            icon={
              <svg {...iconProps}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
            }
          />
          <StatCard
            label="Active transactions"
            figure={activeTx.toLocaleString("en-NG")}
            context={`${paidInFull} paid in full`}
            icon={
              <svg {...iconProps}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg>
            }
          />
        </div>

        <div className="grid2">
          <div className="card">
            <div className="card-h"><h3>Needs action</h3><Link href="/admin/inbox" className="lnk">Open inbox →</Link></div>
            {topItems.length === 0 ? (
              <div className="empty">You&apos;re all caught up.</div>
            ) : (
              topItems.map((item) => (
                <div key={item.id} className="row">
                  <span className={`dot ${item.category === "INSTALLMENT_OVERDUE" ? "r" : "g"}`} />
                  <div className="tx"><b>{item.title}</b><small>{item.subtitle}</small></div>
                  <Link href={item.href} className="btn sm">{item.actionLabel}</Link>
                </div>
              ))
            )}
          </div>
          <div className="card">
            <div className="card-h"><h3>Latest payments</h3><Link href="/admin/payments" className="lnk">View all →</Link></div>
            {latestPayments.length === 0 ? (
              <div className="empty">No confirmed payments yet.</div>
            ) : (
              latestPayments.map((p, i) => (
                <div key={i} className="row">
                  <div className="tx"><b>{p.transaction.customerName}</b><small>{formatDate(p.paymentDate)} · {p.paymentMethod ?? "Bank transfer"}</small></div>
                  <span className="mono price">{formatNaira(p.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
