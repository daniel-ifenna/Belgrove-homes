import Link from "next/link";
import StatusBadge from "@/components/admin/StatusBadge";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/currency";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { redirect } from "next/navigation";
import AdminPagination from "@/components/admin/AdminPagination";
import AdminListCard from "@/components/admin/AdminListCard";
export const dynamic = "force-dynamic";

type SearchParams = { q?: string; status?: string; source?: string; page?: string; from?: string; to?: string; showTest?: string };

const PAGE_SIZE = 25;
const allStatuses = ["pending", "generated", "sent", "failed"] as const;

function formatDate(d: Date | string | null): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function formatDateTime(d: Date | string | null): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function AdminReceiptsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) redirect("/admin/login");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const q = params.q?.trim() ?? "";
  const status = params.status && (allStatuses as readonly string[]).includes(params.status) ? params.status : "";
  const source = params.source && ["BOOKING_FLOW", "ADMIN_MANUAL", "PAYMENT_CONFIRMATION"].includes(params.source) ? params.source : "";
  const showTest = params.showTest === "1";
  const from = params.from ? new Date(params.from) : null;
  const to = params.to ? new Date(params.to) : null;

  const where: any = {};
  if (!showTest) {
    // Receipts inherit test status from their transaction (payments cannot
    // exist without one). Hide test fixtures by default.
    where.transaction = { isTest: false };
  }
  if (status) where.status = status as any;
  if (source) where.source = source as any;
  if (q) {
    where.OR = [
      { ref: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { customerEmail: { contains: q, mode: "insensitive" } },
      { property: { contains: q, mode: "insensitive" } },
      { plotCode: { contains: q, mode: "insensitive" } },
      { estate: { contains: q, mode: "insensitive" } },
    ];
  }
  if (from || to) {
    where.issuedAt = {};
    if (from && !Number.isNaN(from.getTime())) where.issuedAt.gte = from;
    if (to && !Number.isNaN(to.getTime())) {
      const toEnd = new Date(to);
      toEnd.setHours(23, 59, 59, 999);
      where.issuedAt.lte = toEnd;
    }
  }

  const [receipts, total] = await Promise.all([
    prisma.receipt.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { booking: { select: { id: true, ref: true, status: true } }, transaction: { select: { id: true, ref: true } }, sendAttempts: { orderBy: { attemptedAt: "desc" }, take: 1 } },
    }),
    prisma.receipt.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const paginationQuery = (() => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (status) qs.set("status", status);
    if (source) qs.set("source", source);
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    if (showTest) qs.set("showTest", "1");
    return qs.toString();
  })();
  function buildQuery(overrides: Partial<SearchParams>) {
    const merged = { ...params, ...overrides };
    const qs = new URLSearchParams();
    if (merged.q) qs.set("q", merged.q);
    if (merged.status) qs.set("status", merged.status);
    if (merged.source) qs.set("source", merged.source);
    if (merged.from) qs.set("from", merged.from);
    if (merged.to) qs.set("to", merged.to);
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
            <h1 className="font-serif text-[28px] lg:text-[32px] tracking-[-0.02em] text-[var(--ops-text)] leading-none">Receipts</h1>
            <p className="public text-[13px] leading-[1.5] text-[var(--ops-muted)] mt-2">All receipts issued from sales: audit trail, resend, and PDF access.</p>
            <p className="mono text-[11px] tracking-wide uppercase text-[var(--ops-muted)] mt-1">{total} receipts · Page {page} of {totalPages}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/inspections" className="mono text-[11px] tracking-wide uppercase bg-white border border-[var(--ops-border)] rounded-full px-4 py-2 hover:bg-[var(--ops-bg)]">Inspections conducted</Link>
          </div>
        </div>

        <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-4 shadow-[var(--ops-shadow-sm)] mb-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex flex-wrap gap-1.5">
                {[{ label: "All", value: "" }, { label: "Sent", value: "sent" }, { label: "Failed", value: "failed" }, { label: "Generated", value: "generated" }, { label: "Pending", value: "pending" }, { label: "Draft", value: "draft" }].map((f) => {
                  const active = (status ?? "") === f.value;
                  return (
                    <Link key={f.label} href={`/admin/receipts${buildQuery({ status: f.value || undefined, page: "1" })}`} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${active ? "bg-[var(--ops-primary)] text-white border-[var(--ops-primary)]" : "bg-white border-[var(--ops-border)] text-[var(--ops-muted)] hover:border-[var(--ops-border-strong)]"}`}>{f.label}</Link>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[{ label: "All Sources", value: "" }, { label: "Payment", value: "PAYMENT_CONFIRMATION" }, { label: "Booking", value: "BOOKING_FLOW" }, { label: "Manual", value: "ADMIN_MANUAL" }].map((f) => {
                  const active = (source ?? "") === f.value;
                  return (
                    <Link key={f.label} href={`/admin/receipts${buildQuery({ source: f.value || undefined, page: "1" })}`} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${active ? "bg-[#16281F] text-[#D4B368] border-[#16281F]" : "bg-white border-[var(--ops-border)] text-[var(--ops-muted)] hover:border-[var(--ops-border-strong)]"}`}>{f.label}</Link>
                  );
                })}
              </div>
              <form className="flex-1 flex gap-2" action="/admin/receipts" method="get">
                {status && <input type="hidden" name="status" value={status} />}
                {params.from && <input type="hidden" name="from" value={params.from} />}
                {params.to && <input type="hidden" name="to" value={params.to} />}
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ops-muted)]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
                  </span>
                  <input name="q" defaultValue={q} placeholder="Search receipt #, customer, email, property, SKU…" className="w-full bg-[var(--ops-bg)] border border-[var(--ops-border)] rounded-full pl-9 pr-4 py-2.5 text-[13px] placeholder:text-[var(--ops-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ops-primary)]/10" />
                </div>
                <button type="submit" className="text-xs bg-[var(--ops-primary)] text-white rounded-full px-4 py-2 font-medium hover:bg-[var(--ops-deep)]">Search</button>
                {(q || status || source || params.from || params.to) && <Link href="/admin/receipts" className="text-xs text-[var(--ops-muted)] self-center underline underline-offset-4">Clear</Link>}
              </form>
            </div>
            <form className="flex flex-wrap gap-2 items-center" action="/admin/receipts" method="get">
              {q && <input type="hidden" name="q" value={q} />}
              {status && <input type="hidden" name="status" value={status} />}
              {source && <input type="hidden" name="source" value={source} />}
              <span className="mono text-[11px] text-[var(--ops-muted)]">Issued from</span>
              <input type="date" name="from" defaultValue={params.from ?? ""} className="border border-[var(--ops-border)] rounded-full px-3 py-2 text-xs bg-white" />
              <span className="mono text-[11px] text-[var(--ops-muted)]">to</span>
              <input type="date" name="to" defaultValue={params.to ?? ""} className="border border-[var(--ops-border)] rounded-full px-3 py-2 text-xs bg-white" />
              <button type="submit" className="text-xs bg-white border border-[var(--ops-border)] rounded-full px-4 py-2 hover:bg-[var(--ops-bg)]">Filter dates</button>
            </form>
          </div>
        </div>

        <div className="hidden lg:block bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] overflow-hidden shadow-[var(--ops-shadow-sm)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm admin-table">
              <thead>
                <tr className="bg-[var(--ops-bg)]/60 border-b border-[var(--ops-border)] text-left">
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Receipt #</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Customer</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Property</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Transaction</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Amount</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Issued</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Sent</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Status</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)]">Source</th>
                  <th className="px-4 py-3 mono text-[10px] tracking-[0.08em] uppercase font-medium text-[var(--ops-muted)] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ops-border)]/60">
                {receipts.map((r) => (
                  <tr key={r.id} className="hover:bg-[var(--ops-bg)]/50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/receipts/${r.id}`} className="row-lead font-mono text-[12px] font-medium text-[var(--ops-primary)] hover:underline">{r.ref}</Link>
                      <div className="mono text-[10px] text-[var(--ops-muted)]">{r.plotCode ?? ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[13px] font-medium text-[var(--ops-text)] leading-none break-words">{r.customerName}</div>
                      <div className="text-[12px] text-[var(--ops-muted)] break-words">{r.customerEmail}</div>
                      {r.customerPhone && <div className="text-[11px] text-[var(--ops-muted)]">{r.customerPhone}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[13px] text-[var(--ops-text)] leading-tight break-words max-w-[180px]">{r.property}</div>
                      <div className="mono text-[10px] text-[var(--ops-muted)]">{r.estate ?? ""}{r.estate && r.plotCode ? " · " + r.plotCode : r.plotCode ?? ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      {(r as any).transactionId ? (
                        <Link href={`/admin/transactions/${(r as any).transactionId}`} className="font-mono text-[11px] text-[var(--ops-primary)] hover:underline">{(r as any).transaction?.ref ?? "-"}</Link>
                      ) : r.bookingId ? (
                        <Link href={`/admin/bookings/${r.bookingId}`} className="font-mono text-[11px] text-[var(--ops-primary)] hover:underline">{(r as any).booking?.ref ?? "-"}</Link>
                      ) : (
                        <span className="mono text-[11px] text-[var(--ops-muted)]">-</span>
                      )}
                      <div className="mono text-[10px] text-[var(--ops-muted)]">{r.source === "ADMIN_MANUAL" ? "Manual" : "Booking"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="mono text-[12px] font-medium text-[var(--ops-text)] price">{formatNaira(r.finalAmount)}</div>
                      {r.discount > 0 && <div className="mono text-[10px] text-[var(--ops-muted)]">Discount {formatNaira(r.discount)}</div>}
                      <div className="mono text-[10px] text-[var(--ops-muted)]">Before {formatNaira(r.amountBeforeDiscount)}</div>
                    </td>
                    <td className="px-4 py-3 mono text-[11px] text-[var(--ops-muted)]">{formatDate(r.issuedAt)}</td>
                    <td className="px-4 py-3 mono text-[11px] text-[var(--ops-muted)]">{r.sentAt ? formatDateTime(r.sentAt) : "-"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                      {r.error && <div className="mono text-[10px] text-red-600 mt-1 max-w-[160px] break-words">{r.error.slice(0, 80)}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-medium border ${r.source === "ADMIN_MANUAL" ? "bg-[#16281F] text-[#D4B368] border-[#16281F]" : "bg-[#E0F2F1] text-[#0D3328] border-[#B2DFDB]"}`}>{r.source === "ADMIN_MANUAL" ? "Manual" : r.source === "PAYMENT_CONFIRMATION" ? "Payment" : "Booking"}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/admin/receipts/${r.id}`} className="text-xs bg-white border border-[var(--ops-border)] rounded-full px-3 py-1.5 hover:bg-[var(--ops-bg)]">View</Link>
                        <a href={`/api/admin/receipts/${r.ref}/pdf`} target="_blank" className="text-xs bg-white border border-[var(--ops-border)] rounded-full px-3 py-1.5 hover:bg-[var(--ops-bg)]">PDF</a>
                      </div>
                    </td>
                  </tr>
                ))}
                {receipts.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center">
                      <p className="public text-[14px] font-medium text-[var(--ops-text)]">No receipts found</p>
                      <p className="mono text-[11px] text-[var(--ops-muted)] mt-1">Receipts appear here after you mark an inspection as Sold and the receipt is issued.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile */}
        <div className="lg:hidden space-y-3 mt-4">
          {receipts.map((r) => (
            <AdminListCard
              key={r.id}
              href={`/admin/receipts/${r.id}`}
              refText={r.ref}
              name={r.customerName}
              email={r.customerEmail}
              badges={<StatusBadge status={r.status} />}
              rows={[
                { label: "Property", value: r.property },
                { label: "Amount", value: <span className="mono text-[12px] font-medium price">{formatNaira(r.finalAmount)}</span> },
                { label: "Issued", value: <span className="mono text-[11px]">{formatDate(r.issuedAt)}</span> },
                { label: "Sent", value: <span className="mono text-[11px]">{r.sentAt ? formatDateTime(r.sentAt) : "-"}</span> },
              ]}
            />
          ))}
          {receipts.length === 0 && <div className="bg-white border border-[var(--ops-border)] rounded-[var(--ops-radius)] p-8 text-center"><p className="text-sm text-[var(--ops-muted)]">No receipts.</p></div>}
        </div>

        <AdminPagination page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} basePath="/admin/receipts" query={paginationQuery} />
      </div>
    </div>
  );
}
