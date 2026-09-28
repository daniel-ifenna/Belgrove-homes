import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/currency";
import { getOverdueInstallments } from "@/lib/finance";
import { lagosDayKey, lagosTodayInput } from "@/lib/time";

// Action inbox: work queue derived purely from live state (no dismiss flags).
// An item disappears the moment its resolving action commits. Test fixtures
// (isTest) never appear.

export type InboxCategory =
  | "PAYMENT_PENDING_VERIFICATION"
  | "RECEIPT_SEND_FAILED"
  | "SOLD_WITHOUT_TRANSACTION"
  | "INSTALLMENT_OVERDUE"
  | "BOOKING_NEW"
  | "BOOKING_UNASSIGNED"
  | "INSPECTION_AWAITING_OUTCOME"
  | "INSPECTION_DUE_TODAY";

export const INBOX_CATEGORIES: { category: InboxCategory; priority: number; label: string; actionLabel: string }[] = [
  { category: "PAYMENT_PENDING_VERIFICATION", priority: 1, label: "Payments to verify", actionLabel: "Verify payment" },
  { category: "RECEIPT_SEND_FAILED", priority: 2, label: "Failed receipt sends", actionLabel: "Resend" },
  { category: "SOLD_WITHOUT_TRANSACTION", priority: 3, label: "Sold without transaction", actionLabel: "Create transaction" },
  { category: "INSTALLMENT_OVERDUE", priority: 4, label: "Overdue installments", actionLabel: "View transaction" },
  { category: "BOOKING_NEW", priority: 5, label: "New bookings", actionLabel: "Review booking" },
  { category: "BOOKING_UNASSIGNED", priority: 6, label: "Unassigned bookings", actionLabel: "Assign agent" },
  { category: "INSPECTION_AWAITING_OUTCOME", priority: 7, label: "Awaiting outcome", actionLabel: "Record outcome" },
  { category: "INSPECTION_DUE_TODAY", priority: 8, label: "Inspections today", actionLabel: "View" },
];

export type ActionItem = {
  id: string;
  category: InboxCategory;
  priority: number;
  ref: string;
  title: string;
  subtitle: string;
  age: string;
  actionLabel: string;
  href: string;
};

export function ageString(at: Date | string, now: Date = new Date()): string {
  const ms = now.getTime() - new Date(at).getTime();
  if (ms < 0) return "soon";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30);
  return `${months} mo`;
}

type PendingRow = {
  id: string;
  amount: number;
  paymentReference: string | null;
  transactionId: string;
  createdAt: Date;
  transaction: { id: string; ref: string; customerName: string } | null;
};
type OutboxRow = { id: string; relatedId: string | null; updatedAt: Date; createdAt: Date };
type ReceiptRow = { id: string; ref: string; customerName: string; finalAmount: number };
type BookingRow = {
  id: string;
  ref: string;
  name: string;
  location: string;
  estate: string | null;
  createdAt: Date;
  updatedAt: Date;
  inspectedAt: Date | null;
  preferredDate: Date;
  rescheduledDate: Date | null;
};
type TxnRefRow = { id: string; ref: string; customerName: string };

export type InboxDb = {
  payment: { findMany(args: unknown): Promise<PendingRow[]>; count(args: unknown): Promise<number> };
  emailOutbox: { findMany(args: unknown): Promise<OutboxRow[]>; count(args: unknown): Promise<number> };
  receipt: { findMany(args: unknown): Promise<ReceiptRow[]> };
  inspectionBooking: { findMany(args: unknown): Promise<BookingRow[]>; count(args: unknown): Promise<number> };
  transaction: { findMany(args: unknown): Promise<TxnRefRow[]> };
};

const realDb = prisma as unknown as InboxDb;
const LIST_LIMIT = 50;

function testFilter(includeTest: boolean) {
  return includeTest ? {} : { isTest: false };
}

function txnFilter(includeTest: boolean) {
  return includeTest ? {} : { transaction: { isTest: false } };
}

export async function getActionItems(
  opts: {
    includeTest?: boolean;
    now?: Date;
    db?: InboxDb;
    // Injected for hermetic tests (production always queries finance).
    overdue?: Awaited<ReturnType<typeof getOverdueInstallments>>;
  } = {}
): Promise<ActionItem[]> {
  const { includeTest = false, now = new Date(), db = realDb } = opts;
  const items: ActionItem[] = [];

  const overdue = opts.overdue ?? (await getOverdueInstallments(undefined, undefined, { includeTest }));

  const [pendings, failedSends, soldNoTxn, fresh, unassigned, awaiting, scheduled] = await Promise.all([
    db.payment.findMany({
      where: { status: "PENDING_VERIFICATION", ...txnFilter(includeTest) },
      orderBy: { createdAt: "asc" },
      take: LIST_LIMIT,
      include: { transaction: { select: { id: true, ref: true, customerName: true } } },
    }),
    db.emailOutbox.findMany({
      where: { type: "receipt", status: "FAILED" },
      orderBy: { updatedAt: "desc" },
      take: LIST_LIMIT,
    }),
    db.inspectionBooking.findMany({
      where: { outcome: "sold", transaction: null, ...testFilter(includeTest) },
      orderBy: { updatedAt: "desc" },
      take: LIST_LIMIT,
    }),
    db.inspectionBooking.findMany({
      where: { status: "new", ...testFilter(includeTest) },
      orderBy: { createdAt: "asc" },
      take: LIST_LIMIT,
    }),
    db.inspectionBooking.findMany({
      where: { agentId: null, status: { not: "closed" }, ...testFilter(includeTest) },
      orderBy: { createdAt: "asc" },
      take: LIST_LIMIT,
    }),
    db.inspectionBooking.findMany({
      where: { inspectedAt: { not: null }, outcome: null, ...testFilter(includeTest) },
      orderBy: { inspectedAt: "asc" },
      take: LIST_LIMIT,
    }),
    db.inspectionBooking.findMany({
      where: { status: { in: ["approved", "rescheduled"] }, ...testFilter(includeTest) },
      select: { id: true, ref: true, name: true, location: true, preferredDate: true, rescheduledDate: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: LIST_LIMIT,
    }),
  ]);

  for (const p of pendings) {
    items.push({
      id: `pending-${p.id}`,
      category: "PAYMENT_PENDING_VERIFICATION",
      priority: 1,
      ref: p.paymentReference ?? p.id.slice(0, 8),
      title: `Verify ${formatNaira(p.amount)} payment`,
      subtitle: `${p.transaction?.customerName ?? "—"} · ${p.transaction?.ref ?? ""}`,
      age: ageString(p.createdAt, now),
      actionLabel: "Verify payment",
      href: `/admin/transactions/${p.transactionId}#payment-${p.id}`,
    });
  }

  const receiptIds = [...new Set(failedSends.map((o) => o.relatedId).filter((v): v is string => !!v))];
  const receipts = receiptIds.length ? await db.receipt.findMany({ where: { id: { in: receiptIds } } }) : [];
  const receiptById = new Map(receipts.map((r) => [r.id, r]));
  for (const o of failedSends) {
    const r = o.relatedId ? receiptById.get(o.relatedId) : undefined;
    items.push({
      id: `resend-${o.id}`,
      category: "RECEIPT_SEND_FAILED",
      priority: 2,
      ref: r?.ref ?? "receipt",
      title: "Resend failed receipt",
      subtitle: `${r?.customerName ?? "—"} · ${formatNaira(r?.finalAmount ?? 0)}`,
      age: ageString(o.updatedAt ?? o.createdAt, now),
      actionLabel: "Resend",
      href: r ? `/admin/receipts/${r.id}` : "/admin/receipts",
    });
  }

  for (const b of soldNoTxn) {
    items.push({
      id: `sold-${b.id}`,
      category: "SOLD_WITHOUT_TRANSACTION",
      priority: 3,
      ref: b.ref,
      title: "Create transaction",
      subtitle: `${b.name} · ${b.estate ?? b.location}`,
      age: ageString(b.updatedAt, now),
      actionLabel: "Create transaction",
      href: `/admin/transactions/new?bookingId=${b.id}`,
    });
  }

  const txnIds = [...new Set(overdue.map((o) => o.transactionId).filter((v): v is string => !!v))];
  const txns = txnIds.length
    ? await db.transaction.findMany({ where: { id: { in: txnIds } }, select: { id: true, ref: true, customerName: true } })
    : [];
  const txnById = new Map(txns.map((t) => [t.id, t]));
  for (const o of overdue) {
    const t = txnById.get(o.transactionId);
    items.push({
      id: `overdue-${o.id}`,
      category: "INSTALLMENT_OVERDUE",
      priority: 4,
      ref: t?.ref ?? "installment",
      title: `Overdue ${formatNaira(o.scheduledAmount - o.confirmedPaid)}`,
      subtitle: `${t?.customerName ?? "—"} · #${o.installmentNumber}`,
      age: ageString(o.dueDate, now),
      actionLabel: "View transaction",
      href: `/admin/transactions/${o.transactionId}`,
    });
  }

  for (const b of fresh) {
    items.push({
      id: `new-${b.id}`,
      category: "BOOKING_NEW",
      priority: 5,
      ref: b.ref,
      title: "Review booking",
      subtitle: `${b.name} · ${b.location}`,
      age: ageString(b.createdAt, now),
      actionLabel: "Review booking",
      href: `/admin/bookings/${b.id}`,
    });
  }

  for (const b of unassigned) {
    items.push({
      id: `unassigned-${b.id}`,
      category: "BOOKING_UNASSIGNED",
      priority: 6,
      ref: b.ref,
      title: "Assign agent",
      subtitle: `${b.name} · ${b.location}`,
      age: ageString(b.createdAt, now),
      actionLabel: "Assign agent",
      href: `/admin/bookings/${b.id}#assign-agent`,
    });
  }

  for (const b of awaiting) {
    items.push({
      id: `awaiting-${b.id}`,
      category: "INSPECTION_AWAITING_OUTCOME",
      priority: 7,
      ref: b.ref,
      title: "Record outcome",
      subtitle: `${b.name} · inspected ${b.inspectedAt ? ageString(b.inspectedAt, now) + " ago" : ""}`,
      age: ageString(b.inspectedAt ?? b.updatedAt, now),
      actionLabel: "Record outcome",
      href: `/admin/bookings/${b.id}`,
    });
  }

  const todayKey = lagosTodayInput(now);
  for (const b of scheduled) {
    if (lagosDayKey(b.rescheduledDate ?? b.preferredDate) !== todayKey) continue;
    items.push({
      id: `due-${b.id}`,
      category: "INSPECTION_DUE_TODAY",
      priority: 8,
      ref: b.ref,
      title: "Inspection today",
      subtitle: `${b.name} · ${b.location}`,
      age: ageString(b.updatedAt, now),
      actionLabel: "View",
      href: `/admin/bookings/${b.id}`,
    });
  }

  return items.sort((a, b) => a.priority - b.priority);
}

export type ActionCounts = { total: number; byCategory: Record<InboxCategory, number> };

export function emptyCounts(): ActionCounts {
  return {
    total: 0,
    byCategory: {
      PAYMENT_PENDING_VERIFICATION: 0,
      RECEIPT_SEND_FAILED: 0,
      SOLD_WITHOUT_TRANSACTION: 0,
      INSTALLMENT_OVERDUE: 0,
      BOOKING_NEW: 0,
      BOOKING_UNASSIGNED: 0,
      INSPECTION_AWAITING_OUTCOME: 0,
      INSPECTION_DUE_TODAY: 0,
    },
  };
}

export async function getActionCounts(
  opts: { includeTest?: boolean; db?: InboxDb; overdue?: Awaited<ReturnType<typeof getOverdueInstallments>> } = {}
): Promise<ActionCounts> {
  const { includeTest = false, db = realDb } = opts;
  const overdue = opts.overdue ?? (await getOverdueInstallments(undefined, undefined, { includeTest }));
  const [pending, failed, sold, newCount, unassigned, awaiting, scheduled] = await Promise.all([
    db.payment.count({ where: { status: "PENDING_VERIFICATION", ...txnFilter(includeTest) } }),
    db.emailOutbox.count({ where: { type: "receipt", status: "FAILED" } }),
    db.inspectionBooking.count({ where: { outcome: "sold", transaction: null, ...testFilter(includeTest) } }),
    db.inspectionBooking.count({ where: { status: "new", ...testFilter(includeTest) } }),
    db.inspectionBooking.count({ where: { agentId: null, status: { not: "closed" }, ...testFilter(includeTest) } }),
    db.inspectionBooking.count({ where: { inspectedAt: { not: null }, outcome: null, ...testFilter(includeTest) } }),
    db.inspectionBooking.findMany({
      where: { status: { in: ["approved", "rescheduled"] }, ...testFilter(includeTest) },
      select: { preferredDate: true, rescheduledDate: true },
      take: 500,
    }),
  ]);
  const todayKey = lagosTodayInput();
  const dueToday = (scheduled as { preferredDate: Date; rescheduledDate: Date | null }[]).filter(
    (b) => lagosDayKey(b.rescheduledDate ?? b.preferredDate) === todayKey
  ).length;
  const byCategory: Record<InboxCategory, number> = {
    PAYMENT_PENDING_VERIFICATION: pending,
    RECEIPT_SEND_FAILED: failed,
    SOLD_WITHOUT_TRANSACTION: sold,
    INSTALLMENT_OVERDUE: overdue.length,
    BOOKING_NEW: newCount,
    BOOKING_UNASSIGNED: unassigned,
    INSPECTION_AWAITING_OUTCOME: awaiting,
    INSPECTION_DUE_TODAY: dueToday,
  };
  return { total: Object.values(byCategory).reduce((s, n) => s + n, 0), byCategory };
}

// Booking ids that currently have at least one open inbox item (the five
// booking-scoped categories). Used to resolve stale notifications: any
// notification whose booking is absent here has no work left behind it.
export async function getInboxBookingIds(
  opts: { includeTest?: boolean; db?: InboxDb } = {}
): Promise<Set<string>> {
  const { includeTest = false, db = realDb } = opts;
  const tf = includeTest ? {} : { isTest: false };
  const [fresh, unassigned, awaiting, scheduled, sold] = await Promise.all([
    db.inspectionBooking.findMany({ where: { status: "new", ...tf }, select: { id: true } }),
    db.inspectionBooking.findMany({ where: { agentId: null, status: { not: "closed" }, ...tf }, select: { id: true } }),
    db.inspectionBooking.findMany({ where: { inspectedAt: { not: null }, outcome: null, ...tf }, select: { id: true } }),
    db.inspectionBooking.findMany({
      where: { status: { in: ["approved", "rescheduled"] }, ...tf },
      select: { id: true, preferredDate: true, rescheduledDate: true },
    }),
    db.inspectionBooking.findMany({ where: { outcome: "sold", transaction: null, ...tf }, select: { id: true } }),
  ]);
  const todayKey = lagosTodayInput();
  const ids = new Set<string>();
  for (const b of [...fresh, ...unassigned, ...awaiting, ...sold]) ids.add(b.id);
  for (const b of scheduled as { id: string; preferredDate: Date; rescheduledDate: Date | null }[]) {
    if (lagosDayKey(b.rescheduledDate ?? b.preferredDate) === todayKey) ids.add(b.id);
  }
  return ids;
}
