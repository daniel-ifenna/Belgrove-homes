import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/currency";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { redirect } from "next/navigation";
import AdminPagination from "@/components/admin/AdminPagination";
import TestDataToggle, { toggleTestQuery } from "@/components/admin/TestDataToggle";
import { getCollectedRevenue } from "@/lib/finance";
export const dynamic = "force-dynamic";

type SearchParams = { q?: string; status?: string; method?: string; page?: string; showTest?: string };

const PAGE_SIZE = 25;

export default async function PaymentsLedgerPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) redirect("/admin/login");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "";
  const method = params.method ?? "";
  const showTest = params.showTest === "1";

  const where: any = {};
  // Payments inherit test status from their transaction (payments cannot
  // exist without one). Hidden by default.
  if (!showTest) where.transaction = { isTest: false };
  if (status) where.status = status;
  if (method) where.paymentMethod = method;
  if (q) {
    where.OR = [
      { paymentReference: { contains: q, mode: "insensitive" } },
      { bankReference: { contains: q, mode: "insensitive" } },
      { amount: q && !Number.isNaN(Number(q)) ? Number(q) : undefined },
      { transaction: { customerName: { contains: q, mode: "insensitive" } } },
      { transaction: { customerEmail: { contains: q, mode: "insensitive" } } },
      { transaction: { estate: { contains: q, mode: "insensitive" } } },
      { transaction: { ref: { contains: q, mode: "insensitive" } } },
    ].filter((v) => v.amount !== undefined || !v.amount);
  }

  // Remove undefined OR entries
  if (where.OR) where.OR = where.OR.filter((v: any) => v.amount === undefined || typeof v.amount === "number");

  const [payments, total, collected, pendingCount] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        transaction: { select: { ref: true, estate: true, customerName: true, customerEmail: true, paymentPlan: { select: { name: true } } } },
        installment: { select: { installmentNumber: true, type: true } },
        recordedBy: { select: { name: true } },
        confirmedBy: { select: { name: true } },
        receipt: { select: { ref: true, status: true } },
      },
    }),
    prisma.payment.count({ where }),
    // Ledger totals from the finance service (rule 3): collected counts
    // CONFIRMED payments on real transactions only.
    getCollectedRevenue(),
    prisma.payment.count({ where: { transaction: { isTest: false }, status: "PENDING_VERIFICATION" } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const paginationQuery = (() => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (status) qs.set("status", status);
    if (method) qs.set("method", method);
    if (showTest) qs.set("showTest", "1");
    return qs.toString();
  })();
  function buildQuery(overrides: Partial<SearchParams>) {
    const merged = { ...params, ...overrides };
    const qs = new URLSearchParams();
    if (merged.q) qs.set("q", merged.q);
    if (merged.status) qs.set("status", merged.status);
    if (merged.method) qs.set("method", merged.method);
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
            <h1 className="font-serif text-[28px] lg:text-[32px] tracking-[-0.02em] text-[var(--ops-text)] leading-none">Payments Ledger</h1>
            <p className="public text-[13px] leading-[1.5] text-[var(--ops-muted)] mt-2">All confirmed and pending payments — financial truth from the payment ledger.</p>
            <p className="mono text-[11px] tracking-wide uppercase text-[var(--ops-muted)] mt-1">{total} payments · Page {page} of {totalPages}</p>
            <p className="mono text-[11px] tracking-wide uppercase text-[var(--ops-muted)] mt-1">Collected <span className="text-[var(--ops-text)] font-medium price">{formatNaira(collected)}</span> · {pendingCount} awaiting verification</p>
          </div>
          <div className="flex items-center gap-2">
            <TestDataToggle href={`/admin/payments${toggleTestQuery(params as any, showTest)}`} showing={showTest} />
          </div>
        </div>

        <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-4 shadow-[var(--ops-shadow-sm)] mb-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "All", value: "" },
                { label: "Pending", value: "PENDING_VERIFICATION" },
                { label: "Confirmed", value: "CONFIRMED" },
                { label: "Failed", value: "FAILED" },
              ].map((f) => {
                const active = (status ?? "") === f.value;
                return <Link key={f.label} href={`/admin/payments${buildQuery({ status: f.value || undefined, page: "1" })}`} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${active ? "bg-[var(--ops-primary)] text-white border-[var(--ops-primary)]" : "bg-white border-[var(--ops-border)] text-[var(--ops-muted)]"}`}>{f.label}</Link>;
              })}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "All Methods", value: "" },
                { label: "Bank Transfer", value: "Bank Transfer" },
                { label: "Cash", value: "Cash" },
                { label: "Card", value: "Card" },
              ].map((f) => {
                const active = (method ?? "") === f.value;
                return <Link key={f.label} href={`/admin/payments${buildQuery({ method: f.value || undefined, page: "1" })}`} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${active ? "bg-[#16281F] text-[#D4B368] border-[#16281F]" : "bg-white border-[var(--ops-border)] text-[var(--ops-muted)]"}`}>{f.label}</Link>;
              })}
            </div>
            <form className="flex-1 flex gap-2" action="/admin/payments" method="get">
              {status && <input type="hidden" name="status" value={status} />}
              {method && <input type="hidden" name="method" value={method} />}
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ops-muted)]"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg></span>
                <input name="q" defaultValue={q} placeholder="Search payment ref, bank ref, customer, transaction, property…" className="w-full bg-[var(--ops-bg)] border border-[var(--ops-border)] rounded-full pl-9 pr-4 py-2.5 text-[13px] placeholder:text-[var(--ops-muted)]" />
              </div>
              <button type="submit" className="text-xs bg-[var(--ops-primary)] text-white rounded-full px-4 py-2">Search</button>
              {(q || status || method) && <Link href="/admin/payments" className="text-xs text-[var(--ops-muted)] self-center underline">Clear</Link>}
            </form>
          </div>
        </div>

        <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] overflow-hidden shadow-[var(--ops-shadow-sm)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm admin-table">
              <thead>
                <tr className="bg-[var(--ops-bg)]/60 border-b border-[var(--ops-border)] text-left mono text-[10px] uppercase text-[var(--ops-muted)]">
                  <th className="px-4 py-3">Payment Ref</th>
                  <th className="px-4 py-3">Receipt</th>
                  <th className="px-4 py-3">Transaction</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Installment</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ops-border)]/60">
                {payments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-[var(--ops-bg)]/50">
                    <td className="px-4 py-3 font-mono text-[11px] row-lead">{p.paymentReference.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-mono text-[11px]">{p.receipt ? <Link href={`/admin/receipts/${p.receipt.id}`} className="text-[var(--ops-primary)] hover:underline">{p.receipt.ref}</Link> : "—"}</td>
                    <td className="px-4 py-3 font-mono text-[11px]"><Link href={`/admin/transactions/${p.transactionId}`} className="text-[var(--ops-primary)] hover:underline">{p.transaction.ref}</Link><div className="mono text-[10px] text-[var(--ops-muted)]">{p.transaction.estate}</div></td>
                    <td className="px-4 py-3"><div className="text-[13px] leading-none break-all">{p.transaction.customerName}</div><div className="mono text-[11px] text-[var(--ops-muted)] break-all">{p.transaction.customerEmail}</div></td>
                    <td className="px-4 py-3 mono text-[11px]">{p.installment ? `${p.installment.type === "INITIAL" ? "Initial" : `Month ${p.installment.installmentNumber}`} #${p.installment.installmentNumber}` : "—"}</td>
                    <td className="px-4 py-3 mono text-[12px] font-medium text-right price">{formatNaira(p.amount)}</td>
                    <td className="px-4 py-3 mono text-[11px]">{p.paymentMethod ?? "—"}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-medium border ${p.status === "CONFIRMED" ? "bg-[#1F6B3E] text-white border-[#1F6B3E]" : p.status === "PENDING_VERIFICATION" ? "bg-transparent text-[#8B6B1F] border-[#C89B3C]" : "bg-[#A6402F] text-white border-[#A6402F]"}`}>{p.status.replace("_", " ")}</span></td>
                    <td className="px-4 py-3 mono text-[11px]">{new Date(p.paymentDate).toLocaleDateString("en-GB")}</td>
                    <td className="px-4 py-3 text-right"><Link href={`/admin/transactions/${p.transactionId}`} className="text-xs bg-white border border-[var(--ops-border)] rounded-full px-3 py-1.5 hover:bg-[var(--ops-bg)]">View</Link></td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center">
                      <p className="public text-[14px] font-medium">No payments</p>
                      <p className="mono text-[11px] text-[var(--ops-muted)] mt-1">Payments appear here after recording and confirmation.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <AdminPagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} basePath="/admin/payments" query={paginationQuery} />
      </div>
    </div>
  );
}
