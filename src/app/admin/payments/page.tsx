import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/currency";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { redirect } from "next/navigation";
import AdminPagination from "@/components/admin/AdminPagination";
import StatusBadge from "@/components/admin/StatusBadge";
import ClickableRow from "@/components/admin/ClickableRow";
import { formatDate } from "@/lib/booking-ui";
import { getCollectedRevenue } from "@/lib/finance";
export const dynamic = "force-dynamic";

type SearchParams = { q?: string; status?: string; method?: string; page?: string; showTest?: string; showSuperseded?: string };

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
  // Effective payments by default (superseded voided rows hidden unless asked).
  const showSuperseded = params.showSuperseded === "1";

  const where: any = {};
  // Payments inherit test status from their transaction (payments cannot
  // exist without one). Hidden by default.
  if (!showTest) where.transaction = { isTest: false };
  if (!showSuperseded) where.status = { not: "CANCELLED" };
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

  const [payments, total, collected, pendingCount, statusCounts] = await Promise.all([
    prisma.payment.findMany({
      where,
      // Pending first, then newest — the queue floats to the top.
      orderBy: [{ status: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        transaction: { select: { ref: true, estate: true, customerName: true, customerEmail: true, paymentPlan: { select: { name: true } } } },
        installment: { select: { installmentNumber: true, type: true } },
        allocations: { include: { installment: { select: { installmentNumber: true, type: true } } } },
        recordedBy: { select: { name: true } },
        confirmedBy: { select: { name: true } },
        receipt: { select: { id: true, ref: true, sentAt: true } },
      },    }),
    prisma.payment.count({ where }),
    // Ledger totals from the finance service (rule 3): collected counts
    // CONFIRMED payments on real transactions only.
    getCollectedRevenue(),
    prisma.payment.count({ where: { transaction: { isTest: false }, status: "PENDING_VERIFICATION" } }),
    prisma.payment.groupBy({ by: ["status"], where, _count: { status: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const paginationQuery = (() => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (status) qs.set("status", status);
    if (method) qs.set("method", method);
    if (showTest) qs.set("showTest", "1");
    if (showSuperseded) qs.set("showSuperseded", "1");
    return qs.toString();
  })();
  function buildQuery(overrides: Partial<SearchParams>) {
    const merged = { ...params, ...overrides };
    const qs = new URLSearchParams();
    if (merged.q) qs.set("q", merged.q);
    if (merged.status) qs.set("status", merged.status);
    if (merged.method) qs.set("method", merged.method);
    if (merged.showTest) qs.set("showTest", merged.showTest);
    if (merged.showSuperseded) qs.set("showSuperseded", merged.showSuperseded);
    if (merged.page && merged.page !== "1") qs.set("page", merged.page);
    const str = qs.toString();
    return str ? `?${str}` : "";
  }

  return (
    <div className="min-h-screen bg-[var(--ops-bg)]">
      <div className="max-w-[1180px] mx-auto px-6 lg:px-7 py-6">
        <div className="ph">
          <div>
            <h1>Payments</h1>
            <p>Money received across all transactions. · {total} payments · Page {page} of {totalPages}</p>
          </div>
          <div className="acts">
            <span className="mono text-[11px] text-[var(--ops-muted)]">Collected <span className="price text-[var(--ops-text)]">{formatNaira(collected)}</span> · {pendingCount} awaiting verification</span>
          </div>
        </div>
        <div className="mb-4">
          <Link href={`/admin/payments${buildQuery({ showSuperseded: showSuperseded ? undefined : "1", page: "1" })}`} className="lnk">
            {showSuperseded ? "Hide superseded entries" : "Show superseded entries"}
          </Link>
        </div>

        <div className="card">
          <div className="filters">
            {[
              { label: "All", value: "" },
              { label: "Pending", value: "PENDING_VERIFICATION" },
              { label: "Confirmed", value: "CONFIRMED" },
              { label: "Failed", value: "FAILED" },
            ].map((f) => {
              const active = (status ?? "") === f.value;
              const n = f.value ? (statusCounts.find((c) => c.status === f.value)?._count.status ?? 0) : total;
              return <Link key={f.label} href={`/admin/payments${buildQuery({ status: f.value || undefined, page: "1" })}`} className={`fp${active ? " on" : ""}`}>{f.label} ({n})</Link>;
            })}
            {[
              { label: "All methods", value: "" },
              { label: "Bank Transfer", value: "Bank Transfer" },
              { label: "Cash", value: "Cash" },
              { label: "Card", value: "Card" },
            ].map((f) => {
              const active = (method ?? "") === f.value;
              return <Link key={f.label} href={`/admin/payments${buildQuery({ method: f.value || undefined, page: "1" })}`} className={`fp${active ? " on" : ""}`}>{f.label}</Link>;
            })}
            <form className="fs" style={{ flex: 1 }} action="/admin/payments" method="get">
              {status && <input type="hidden" name="status" value={status} />}
              {method && <input type="hidden" name="method" value={method} />}
              <input name="q" defaultValue={q} placeholder="Search payment ref, bank ref, customer…" style={{ border: "none", outline: "none", background: "transparent", flex: 1, fontSize: "12.5px" }} />
              {(q || status || method) && <Link href="/admin/payments" className="lnk">Clear</Link>}
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="t">
              <thead>
                <tr>
                  <th>Payment Ref</th>
                  <th>Bank Ref</th>
                  <th>Receipt</th>
                  <th>Transaction</th>
                  <th>Customer</th>
                  <th>Installment</th>
                  <th className="r">Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Confirmed By</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <ClickableRow key={p.id} href={`/admin/transactions/${p.transactionId}#payment-${p.id}`}>
                    <td className="num"><Link href={`/admin/transactions/${p.transactionId}#payment-${p.id}`} className="row-lead font-medium text-[var(--ops-text)] hover:underline">{p.paymentReference}</Link></td>
                    <td className="num">{p.bankReference ?? "-"}</td>
                    <td className="num">{p.receipt ? <Link href={`/admin/receipts/${p.receipt.id}`} className="text-[var(--ops-primary)] hover:underline">{p.receipt.ref}</Link> : "-"}</td>
                    <td className="num"><Link href={`/admin/transactions/${p.transactionId}`} className="text-[var(--ops-primary)] hover:underline">{p.transaction.ref}</Link><small>{p.transaction.estate}</small></td>
                    <td><b>{p.transaction.customerName}</b><small>{p.transaction.customerEmail}</small></td>
                    <td>{p.allocations?.length ? p.allocations.map((a: any) => `${a.installment.type === "INITIAL" ? "Initial" : `Month ${a.installment.installmentNumber}`}`).join(", ") : p.installment ? `${p.installment.type === "INITIAL" ? "Initial" : `Month ${p.installment.installmentNumber}`} #${p.installment.installmentNumber}` : "-"}</td>
                    <td className="r num">{formatNaira(p.amount)}</td>
                    <td>{p.paymentMethod ?? "-"}</td>
                    <td><StatusBadge status={p.status} className="px-2 py-1 text-[10px]" />{p.correctsPaymentId ? <span className="ml-1 mono text-[10px] px-2 py-1 rounded-full bg-[#E0F2F1] text-[#0D3328] border border-[#B2DFDB]">Corrected</span> : null}</td>
                    <td>{formatDate(p.paymentDate)}</td>
                    <td>{p.confirmedBy?.name ?? "-"}</td>
                  </ClickableRow>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={11}><div className="empty">No payments. They appear here after recording and confirmation.</div></td>
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
