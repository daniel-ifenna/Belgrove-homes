import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/currency";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { redirect } from "next/navigation";
import AdminPagination from "@/components/admin/AdminPagination";
import AdminListCard from "@/components/admin/AdminListCard";
// Money/document dates go through the shared Lagos helpers (src/lib/time.ts)
// with an explicit zone — never server-local toLocaleString, which shifted
// printed dates by a day between panels (TXN-2026-62831).
import { formatLagos } from "@/lib/time";
export const dynamic = "force-dynamic";

type SearchParams = { q?: string; source?: string; page?: string; from?: string; to?: string; showTest?: string; voided?: string };

const PAGE_SIZE = 25;

function formatDate(d: Date | string | null): string {
  if (!d) return "-";
  return formatLagos(d, "date");
}
function formatDateTime(d: Date | string | null): string {
  if (!d) return "-";
  return formatLagos(d, "datetime");
}

export default async function AdminReceiptsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) redirect("/admin/login");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const q = params.q?.trim() ?? "";
  const source = params.source && ["BOOKING_FLOW", "ADMIN_MANUAL", "PAYMENT_CONFIRMATION"].includes(params.source) ? params.source : "";
  const voidedOnly = params.voided === "1";
  const showTest = params.showTest === "1";
  const from = params.from ? new Date(params.from) : null;
  const to = params.to ? new Date(params.to) : null;

  const where: any = {};
  if (!showTest) {
    // Receipts inherit test status from their transaction (payments cannot
    // exist without one). Hide test fixtures by default.
    where.transaction = { isTest: false };
  }
  if (source) where.source = source as any;
  if (voidedOnly) where.voidedAt = { not: null };
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
      omit: { pdfData: true },
      include: { booking: { select: { id: true, ref: true, status: true } }, transaction: { select: { id: true, ref: true } } },
    }),
    prisma.receipt.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const paginationQuery = (() => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (source) qs.set("source", source);
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    if (showTest) qs.set("showTest", "1");
    if (voidedOnly) qs.set("voided", "1");
    return qs.toString();
  })();
  function buildQuery(overrides: Partial<SearchParams>) {
    const merged = { ...params, ...overrides };
    const qs = new URLSearchParams();
    if (merged.q) qs.set("q", merged.q);
    if (merged.source) qs.set("source", merged.source);
    if (merged.from) qs.set("from", merged.from);
    if (merged.to) qs.set("to", merged.to);
    if (merged.showTest) qs.set("showTest", merged.showTest);
    if (merged.voided) qs.set("voided", merged.voided);
    if (merged.page && merged.page !== "1") qs.set("page", merged.page);
    const str = qs.toString();
    return str ? `?${str}` : "";
  }

  return (
    <div className="min-h-screen bg-[var(--ops-bg)]">
      <div className="max-w-[1180px] mx-auto px-6 lg:px-7 py-6">
        <div className="ph">
          <div>
            <h1>Receipts</h1>
            <p>All receipts issued from sales. · {total} receipts · Page {page} of {totalPages}</p>
          </div>
          <div className="acts">
            <Link href="/admin/inspections" className="btn">Inspections conducted</Link>
          </div>
        </div>

        <div className="card">
          <div className="filters">
            {[{ label: "All sources", value: "" }, { label: "Payment", value: "PAYMENT_CONFIRMATION" }, { label: "Booking", value: "BOOKING_FLOW" }, { label: "Manual", value: "ADMIN_MANUAL" }].map((f) => {
              const active = (source ?? "") === f.value;
              return (
                <Link key={f.label} href={`/admin/receipts${buildQuery({ source: f.value || undefined, page: "1" })}`} className={`fp${active ? " on" : ""}`}>{f.label}</Link>
              );
            })}
            <Link href={`/admin/receipts${buildQuery({ voided: voidedOnly ? undefined : "1", page: "1" })}`} className={`fp${voidedOnly ? " on" : ""}`}>Voided</Link>
            <form className="fs" style={{ flex: 1 }} action="/admin/receipts" method="get">
              <input name="q" defaultValue={q} placeholder="Search receipt #, customer, email, property, SKU…" style={{ border: "none", outline: "none", background: "transparent", flex: 1, fontSize: "12.5px" }} />
              {(q || source || params.from || params.to || voidedOnly) && <Link href="/admin/receipts" className="lnk">Clear</Link>}
            </form>
          </div>
          <form className="filters" style={{ borderTop: "none", paddingTop: 0 }} action="/admin/receipts" method="get">
            {q && <input type="hidden" name="q" value={q} />}
            {source && <input type="hidden" name="source" value={source} />}
            <span className="mono text-[11px] text-[var(--ops-muted)]">Issued from</span>
            <input type="date" name="from" defaultValue={params.from ?? ""} className="border border-[var(--ops-border)] rounded-full px-3 py-2 text-xs bg-white" />
            <span className="mono text-[11px] text-[var(--ops-muted)]">to</span>
            <input type="date" name="to" defaultValue={params.to ?? ""} className="border border-[var(--ops-border)] rounded-full px-3 py-2 text-xs bg-white" />
            <button type="submit" className="btn sm">Filter dates</button>
          </form>
        </div>

        <div className="hidden lg:block card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="t">
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Customer</th>
                  <th>Property</th>
                  <th>Transaction</th>
                  <th>Amount</th>
                  <th>Issued</th>
                  <th>Emailed</th>
                  <th>Source</th>
                  <th className="r">Actions</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.id} className="clk">
                    <td>
                      <Link href={`/admin/receipts/${r.id}`} className="row-lead num font-medium text-[var(--ops-primary)] hover:underline">{r.ref}</Link>
                      <small>{r.plotCode ?? ""}</small>
                      {(r as any).voidedAt ? <span className="chip red">VOID</span> : ""}
                    </td>
                    <td>
                      <b>{r.customerName}</b>
                      <small>{r.customerEmail}</small>
                      {r.customerPhone && <small>{r.customerPhone}</small>}
                    </td>
                    <td>
                      <div className="break-words max-w-[180px]">{r.property}</div>
                      <small>{r.estate ?? ""}{r.estate && r.plotCode ? " · " + r.plotCode : r.plotCode ?? ""}</small>
                    </td>
                    <td>
                      {(r as any).transactionId ? (
                        <Link href={`/admin/transactions/${(r as any).transactionId}`} className="num text-[var(--ops-primary)] hover:underline">{(r as any).transaction?.ref ?? "-"}</Link>
                      ) : r.bookingId ? (
                        <Link href={`/admin/bookings/${r.bookingId}`} className="num text-[var(--ops-primary)] hover:underline">{(r as any).booking?.ref ?? "-"}</Link>
                      ) : (
                        <span className="mono text-[11px] text-[var(--ops-muted)]">-</span>
                      )}
                      <small>{r.source === "ADMIN_MANUAL" ? "Manual" : "Booking"}</small>
                    </td>
                    <td>
                      <div className="num price">{formatNaira(r.finalAmount)}</div>
                      {r.discount > 0 && <small>Discount {formatNaira(r.discount)}</small>}
                      <small>Before {formatNaira(r.amountBeforeDiscount)}</small>
                    </td>
                    <td>{formatDate(r.issuedAt)}</td>
                    <td>{r.sentAt ? formatDateTime(r.sentAt) : <span className="chip gold">Not emailed</span>}</td>
                    <td>
                      <span className={`chip ${r.source === "ADMIN_MANUAL" ? "dark" : "lg"}`}>{r.source === "ADMIN_MANUAL" ? "Manual" : r.source === "PAYMENT_CONFIRMATION" ? "Payment" : "Booking"}</span>
                    </td>
                    <td className="r">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/admin/receipts/${r.id}`} className="btn sm">View</Link>
                        <a href={`/api/admin/receipts/${r.ref}/pdf`} target="_blank" className="btn sm">PDF</a>
                      </div>
                    </td>
                  </tr>
                ))}
                {receipts.length === 0 && (
                  <tr>
                    <td colSpan={9}><div className="empty">No receipts found. Receipts appear here after you mark an inspection as Sold and the receipt is issued.</div></td>
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
              badges={r.sentAt ? <span className="inline-flex px-2 py-1 rounded-full text-[10px] font-medium border bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]">Emailed</span> : <span className="inline-flex px-2 py-1 rounded-full text-[10px] font-medium border bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]">Not emailed</span>}
              rows={[
                { label: "Property", value: r.property },
                { label: "Amount", value: <span className="mono text-[12px] font-medium price">{formatNaira(r.finalAmount)}</span> },
                { label: "Issued", value: <span className="mono text-[11px]">{formatDate(r.issuedAt)}</span> },
                { label: "Emailed", value: <span className="mono text-[11px]">{r.sentAt ? formatDateTime(r.sentAt) : "Not emailed"}</span> },
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
