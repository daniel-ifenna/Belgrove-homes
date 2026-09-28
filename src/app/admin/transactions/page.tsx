import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/currency";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { redirect } from "next/navigation";
import AdminPagination from "@/components/admin/AdminPagination";
import TestDataToggle, { toggleTestQuery } from "@/components/admin/TestDataToggle";
import { getTransactionOverviews } from "@/lib/finance";
export const dynamic = "force-dynamic";

type SearchParams = { q?: string; status?: string; plan?: string; page?: string; showTest?: string };

const PAGE_SIZE = 25;

function statusBadge(status: string) {
  switch (status) {
    case "PAID_IN_FULL":
      return "bg-[#16281D] text-white border-[#16281D]";
    case "ACTIVE":
      return "bg-[#1F6B3E] text-white border-[#1F6B3E]";
    case "DRAFT":
      return "bg-transparent text-[#6B6252] border-[#D8CFC0]";
    case "CANCELLED":
      return "bg-[#A6402F] text-white border-[#A6402F]";
    default:
      return "bg-[#E4D8C1] text-[#6B6252] border-[#E4D8C1]";
  }
}

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) redirect("/admin/login");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "";
  const plan = params.plan ?? "";
  const showTest = params.showTest === "1";

  const where: any = {};
  if (!showTest) where.isTest = false;
  if (status) where.status = status;
  if (plan) where.paymentPlanId = plan;
  if (q) {
    where.OR = [
      { ref: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { customerEmail: { contains: q, mode: "insensitive" } },
      { estate: { contains: q, mode: "insensitive" } },
      { plotCode: { contains: q, mode: "insensitive" } },
    ];
  }

  const [transactions, total, plans] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { paymentPlan: true },
    }),
    prisma.transaction.count({ where }),
    prisma.paymentPlan.findMany({ where: { isActive: true } }),
  ]);

  // Money figures from the finance service (rule 3) — never stored-column
  // reads or inline filters here.
  const overviews = await getTransactionOverviews(transactions.map((t) => t.id));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const paginationQuery = (() => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (status) qs.set("status", status);
    if (plan) qs.set("plan", plan);
    if (showTest) qs.set("showTest", "1");
    return qs.toString();
  })();
  function buildQuery(overrides: Partial<SearchParams>) {
    const merged = { ...params, ...overrides };
    const qs = new URLSearchParams();
    if (merged.q) qs.set("q", merged.q);
    if (merged.status) qs.set("status", merged.status);
    if (merged.plan) qs.set("plan", merged.plan);
    if (merged.showTest) qs.set("showTest", merged.showTest);
    if (merged.page && merged.page !== "1") qs.set("page", merged.page);
    const str = qs.toString();
    return str ? `?${str}` : "";
  }

  return (
    <div className="min-h-screen bg-[var(--ops-bg)]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-serif text-[28px] lg:text-[32px] tracking-[-0.02em] text-[var(--ops-text)] leading-none">Transactions</h1>
            <p className="public text-[13px] leading-[1.5] text-[var(--ops-muted)] mt-2">Source of truth for property sales — payment plans, schedules, and outstanding balances.</p>
            <p className="mono text-[11px] tracking-wide uppercase text-[var(--ops-muted)] mt-1">{total} transactions · Page {page} of {totalPages}</p>
          </div>
          <div className="flex items-center gap-2">
            <TestDataToggle href={`/admin/transactions${toggleTestQuery(params as any, showTest)}`} showing={showTest} />
            <Link href="/admin/transactions/new" className="mono text-[11px] tracking-wide uppercase bg-[var(--ops-primary)] text-white rounded-full px-5 py-2.5 hover:bg-[var(--ops-deep)]">+ New Transaction</Link>
            <Link href="/admin/receipts" className="mono text-[11px] tracking-wide uppercase bg-white border border-[var(--ops-border)] rounded-full px-4 py-2 hover:bg-[var(--ops-bg)]">Receipts</Link>
          </div>
        </div>

        <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-4 shadow-[var(--ops-shadow-sm)] mb-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex flex-wrap gap-1.5">
              {[{ label: "All", value: "" }, { label: "Active", value: "ACTIVE" }, { label: "Paid Full", value: "PAID_IN_FULL" }, { label: "Draft", value: "DRAFT" }].map((f) => {
                const active = (status ?? "") === f.value;
                return <Link key={f.label} href={`/admin/transactions${buildQuery({ status: f.value || undefined, page: "1" })}`} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${active ? "bg-[var(--ops-primary)] text-white border-[var(--ops-primary)]" : "bg-white border-[var(--ops-border)] text-[var(--ops-muted)]"}`}>{f.label}</Link>;
              })}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[{ label: "All Plans", value: "" }, ...plans.map((p) => ({ label: p.name, value: p.id }))].map((f) => {
                const active = (plan ?? "") === f.value;
                return <Link key={f.label} href={`/admin/transactions${buildQuery({ plan: f.value || undefined, page: "1" })}`} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${active ? "bg-[#16281F] text-[#D4B368] border-[#16281F]" : "bg-white border-[var(--ops-border)] text-[var(--ops-muted)]"}`}>{f.label}</Link>;
              })}
            </div>
            <form className="flex-1 flex gap-2" action="/admin/transactions" method="get">
              {status && <input type="hidden" name="status" value={status} />}
              {plan && <input type="hidden" name="plan" value={plan} />}
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ops-muted)]"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg></span>
                <input name="q" defaultValue={q} placeholder="Search ref, customer, email, property…" className="w-full bg-[var(--ops-bg)] border border-[var(--ops-border)] rounded-full pl-9 pr-4 py-2.5 text-[13px] placeholder:text-[var(--ops-muted)]" />
              </div>
              <button type="submit" className="text-xs bg-[var(--ops-primary)] text-white rounded-full px-4 py-2">Search</button>
              {(q || status || plan) && <Link href="/admin/transactions" className="text-xs text-[var(--ops-muted)] self-center underline">Clear</Link>}
            </form>
          </div>
        </div>

        <div className="hidden lg:block bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] overflow-hidden shadow-[var(--ops-shadow-sm)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm admin-table">
              <thead>
                <tr className="bg-[var(--ops-bg)]/60 border-b border-[var(--ops-border)] text-left">
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Transaction</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Customer</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Property</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Plan</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Total Payable</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Outstanding</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Status</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ops-border)]/60">
                {transactions.map((t) => {
                  const ov = overviews.get(t.id);
                  if (!ov) return null;
                  const overdue = ov.overdueCount;
                  const outstanding = ov.outstanding;
                  return (
                    <tr key={t.id} className="hover:bg-[var(--ops-bg)]/50">
                      <td className="px-4 py-3">
                        <Link href={`/admin/transactions/${t.id}`} className="row-lead font-mono text-[12px] font-medium text-[var(--ops-primary)] hover:underline">{t.ref}</Link>
                        <div className="mono text-[10px] text-[var(--ops-muted)]">{t.plotCode ?? ""} {t.sqm ? `· ${t.sqm}sqm` : ""}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[13px] font-medium leading-none break-all">{t.customerName}</div>
                        <div className="text-[12px] text-[var(--ops-muted)] break-all">{t.customerEmail}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[13px] leading-tight break-words max-w-[160px]">{t.estate} {t.unitType ? `· ${t.unitType}` : ""}</div>
                        <div className="mono text-[10px] text-[var(--ops-muted)]">{t.plotQuantity} plot{t.plotQuantity > 1 ? "s" : ""} · {formatNaira(t.unitPrice)} each</div>
                      </td>
                      <td className="px-4 py-3 mono text-[11px]">{t.paymentPlan.name}</td>
                      <td className="px-4 py-3 mono text-[12px] font-medium price">{formatNaira(t.totalPayable)}</td>
                      <td className="px-4 py-3">
                        <div className={`mono text-[12px] font-bold price ${outstanding === 0 ? "text-[#065F46]" : overdue > 0 ? "text-[#9F1239]" : "text-[#92400E]"}`}>{formatNaira(outstanding)}</div>
                        {overdue > 0 && <div className="mono text-[10px] text-[#9F1239]">{overdue} overdue</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-medium border ${statusBadge(t.status)}`}>{t.status.replace("_", " ")}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/transactions/${t.id}`} className="text-xs bg-white border border-[var(--ops-border)] rounded-full px-3 py-1.5 hover:bg-[var(--ops-bg)]">View</Link>
                      </td>
                    </tr>
                  );
                })}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <p className="public text-[14px] font-medium">No transactions</p>
                      <p className="mono text-[11px] text-[var(--ops-muted)] mt-1">Create a transaction from a booking or manually.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:hidden space-y-3 mt-4">
          {transactions.map((t) => {
            const ov = overviews.get(t.id);
            if (!ov) return null;
            return (
            <Link key={t.id} href={`/admin/transactions/${t.id}`} className="block bg-white border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-[12px] font-medium text-[var(--ops-primary)]">{t.ref}</div>
                  <div className="text-[14px] font-medium mt-1 break-all">{t.customerName}</div>
                </div>
                <span className={`px-2 py-1 rounded-full text-[11px] font-medium border ${statusBadge(t.status)}`}>{t.status}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div><div className="mono text-[10px] uppercase text-[var(--ops-muted)]">Property</div><div className="text-[13px] break-words">{t.estate}</div></div>
                <div><div className="mono text-[10px] uppercase text-[var(--ops-muted)]">Outstanding</div><div className="mono text-[12px] font-bold price">{formatNaira(ov.outstanding)}</div></div>
                <div><div className="mono text-[10px] uppercase text-[var(--ops-muted)]">Total</div><div className="mono text-[11px] price">{formatNaira(t.totalPayable)}</div></div>
                <div><div className="mono text-[10px] uppercase text-[var(--ops-muted)]">Plan</div><div className="mono text-[11px]">{t.paymentPlan.name}</div></div>
              </div>
            </Link>
            );
          })}
        </div>

        <AdminPagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} basePath="/admin/transactions" query={paginationQuery} />
      </div>
    </div>
  );
}
