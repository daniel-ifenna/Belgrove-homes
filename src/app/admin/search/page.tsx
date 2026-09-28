import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { redirect } from "next/navigation";
import { formatNaira } from "@/lib/currency";
import TestDataToggle from "@/components/admin/TestDataToggle";

export const dynamic = "force-dynamic";

type SearchParams = { q?: string; showTest?: string };

function Group({
  title,
  href,
  children,
  count,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
  count: number;
}) {
  return (
    <div className="bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] overflow-hidden shadow-[var(--ops-shadow-sm)]">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <h2 className="mono text-[11px] tracking-[0.12em] uppercase text-[var(--ops-muted)]">
          {title} · {count}
        </h2>
        <Link href={href} className="mono text-[11px] text-[var(--ops-primary)] hover:underline underline-offset-4">
          View all →
        </Link>
      </div>
      <div className="divide-y divide-[var(--ops-border)]/60">{children}</div>
    </div>
  );
}

function Row({ href, primary, secondary }: { href: string; primary: string; secondary: string }) {
  return (
    <Link href={href} className="flex items-baseline justify-between gap-3 px-5 py-2.5 hover:bg-[rgba(28,43,32,0.03)] transition-colors">
      <span className="row-lead font-mono text-[12px] font-medium text-[var(--ops-primary)]">{primary}</span>
      <span className="text-[12px] text-[var(--ops-muted)] break-all text-right">{secondary}</span>
    </Link>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) redirect("/admin/login");
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const showTest = params.showTest === "1";
  const testBooking = showTest ? {} : { isTest: false };
  const testTxn = showTest ? {} : { transaction: { isTest: false } };
  const testDirect = showTest ? {} : { isTest: false };

  if (!q) redirect("/admin");

  // Substring matching finds old BEL- and new prefixed refs alike.
  const [bookings, transactions, payments, receipts, customers] = q
    ? await Promise.all([
        prisma.inspectionBooking.findMany({
          where: {
            ...testBooking,
            OR: [
              { ref: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
              { location: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 8,
          orderBy: { updatedAt: "desc" },
        }),
        prisma.transaction.findMany({
          where: {
            ...testDirect,
            OR: [
              { ref: { contains: q, mode: "insensitive" } },
              { customerName: { contains: q, mode: "insensitive" } },
              { customerEmail: { contains: q, mode: "insensitive" } },
              { estate: { contains: q, mode: "insensitive" } },
              { plotCode: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 8,
          orderBy: { updatedAt: "desc" },
        }),
        prisma.payment.findMany({
          where: {
            ...testTxn,
            OR: [
              { paymentReference: { contains: q, mode: "insensitive" } },
              { bankReference: { contains: q, mode: "insensitive" } },
              ...(Number.isFinite(Number(q)) && q !== "" ? [{ amount: Number(q) }] : []),
            ],
          },
          include: { transaction: { select: { id: true, ref: true } } },
          take: 8,
          orderBy: { createdAt: "desc" },
        }),
        prisma.receipt.findMany({
          where: {
            ...testTxn,
            OR: [
              { ref: { contains: q, mode: "insensitive" } },
              { customerName: { contains: q, mode: "insensitive" } },
              { customerEmail: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 8,
          orderBy: { issuedAt: "desc" },
        }),
        prisma.customer.findMany({
          where: {
            ...(showTest ? {} : { isTest: false }),
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
            ],
          },
          take: 8,
          orderBy: { createdAt: "desc" },
        }),
      ])
    : [[], [], [], [], []];

  const total = bookings.length + transactions.length + payments.length + receipts.length + customers.length;

  return (
    <div className="min-h-screen bg-[var(--ops-bg)]">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-serif text-[28px] lg:text-[32px] tracking-[-0.02em] text-[var(--ops-text)] leading-none">
              Search
            </h1>
            <p className="public text-[13px] leading-[1.5] text-[var(--ops-muted)] mt-2">
              {total} result{total === 1 ? "" : "s"} for <span className="font-mono font-medium text-[var(--ops-text)]">{q}</span>
            </p>
          </div>
          <TestDataToggle href={showTest ? `/admin/search?q=${encodeURIComponent(q)}` : `/admin/search?q=${encodeURIComponent(q)}&showTest=1`} showing={showTest} />
        </div>

        {total === 0 ? (
          <p className="public text-[14px] text-[var(--ops-muted)] bg-[var(--ops-surface)] border border-[var(--ops-border)] rounded-[var(--ops-radius)] px-5 py-12 text-center">
            Nothing found for “{q}” — try a name, email, phone or reference (BEL-, BKG-, TXN-, PAY-, RCT- all work).
          </p>
        ) : (
          <div className="space-y-4">
            {bookings.length > 0 && (
              <Group title="Bookings" href={`/admin/bookings?q=${encodeURIComponent(q)}`} count={bookings.length}>
                {bookings.map((b) => (
                  <Row key={b.id} href={`/admin/bookings/${b.id}`} primary={b.ref} secondary={`${b.name} · ${b.status}`} />
                ))}
              </Group>
            )}
            {transactions.length > 0 && (
              <Group title="Transactions" href={`/admin/transactions?q=${encodeURIComponent(q)}`} count={transactions.length}>
                {transactions.map((t) => (
                  <Row key={t.id} href={`/admin/transactions/${t.id}`} primary={t.ref} secondary={`${t.customerName} · ${t.status}`} />
                ))}
              </Group>
            )}
            {payments.length > 0 && (
              <Group title="Payments" href={`/admin/payments?q=${encodeURIComponent(q)}`} count={payments.length}>
                {payments.map((p) => (
                  <Row key={p.id} href={`/admin/transactions/${p.transactionId}#payment-${p.id}`} primary={p.paymentReference} secondary={`${formatNaira(p.amount)} · ${p.status}`} />
                ))}
              </Group>
            )}
            {receipts.length > 0 && (
              <Group title="Receipts" href={`/admin/receipts?q=${encodeURIComponent(q)}`} count={receipts.length}>
                {receipts.map((r) => (
                  <Row key={r.id} href={`/admin/receipts/${r.id}`} primary={r.ref} secondary={`${r.customerName} · ${r.status}`} />
                ))}
              </Group>
            )}
            {customers.length > 0 && (
              <Group title="Customers" href="/admin/bookings" count={customers.length}>
                {customers.map((c) => (
                  <div key={c.id} className="flex items-baseline justify-between gap-3 px-5 py-2.5">
                    <span className="row-lead text-[13px] font-medium text-[var(--ops-text)] break-all">{c.name}</span>
                    <span className="font-mono text-[12px] text-[var(--ops-muted)] break-all text-right">{c.email}</span>
                  </div>
                ))}
              </Group>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
