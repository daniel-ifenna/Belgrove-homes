import { prisma } from "@/lib/prisma";

// Read-only audit history: merges BookingActivity (booking lifecycle) with
// AuditEvent (payment/transaction/receipt mutations). For detail pages.
// Never used for action state.

export type HistoryRow = {
  id: string;
  at: Date;
  actor: string;
  action: string;
  entityType: string;
  entityRef: string;
  detail: string | null;
  href: string;
};

type ActivityDb = {
  auditEvent: { findMany(args: unknown): Promise<AuditRow[]> };
  bookingActivity: { findMany(args: unknown): Promise<BookingActivityRow[]> };
  inspectionBooking: { findMany(args: unknown): Promise<{ id: string; ref: string }[]> };
  transaction: { findMany(args: unknown): Promise<{ id: string; ref: string }[]> };
  payment: { findMany(args: unknown): Promise<{ id: string; paymentReference: string; transactionId: string }[]> };
  receipt: { findMany(args: unknown): Promise<{ id: string; ref: string }[]> };
};

type AuditRow = {
  id: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  createdAt: Date;
};

type BookingActivityRow = {
  id: string;
  bookingId: string;
  actorName: string;
  action: string;
  note: string | null;
  createdAt: Date;
};

const realDb = prisma as unknown as ActivityDb;

function auditDetail(action: string, after: unknown): string | null {
  if (!after || typeof after !== "object") return null;
  const a = after as Record<string, unknown>;
  const bits: string[] = [];
  if (typeof a.amount === "number") bits.push(`₦${a.amount.toLocaleString("en-NG")}`);
  if (typeof a.status === "string") bits.push(a.status);
  if (typeof a.receiptRef === "string") bits.push(a.receiptRef);
  if (typeof a.reason === "string" && a.reason) bits.push(a.reason.slice(0, 80));
  if (typeof a.ref === "string") bits.push(a.ref);
  return bits.length > 0 ? `${action}: ${bits.join(" · ")}` : action;
}

export async function getEntityHistory(
  entityType: string,
  entityId: string,
  db: ActivityDb = realDb
): Promise<HistoryRow[]> {
  if (entityType === "booking") {
    const rows = await db.bookingActivity.findMany({
      where: { bookingId: entityId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((a) => ({
      id: a.id,
      at: new Date(a.createdAt),
      actor: a.actorName,
      action: a.action,
      entityType: "booking",
      entityRef: entityId.slice(0, 8),
      detail: a.note,
      href: `/admin/bookings/${entityId}`,
    }));
  }
  const rows = await db.auditEvent.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const href =
    entityType === "transaction"
      ? `/admin/transactions/${entityId}`
      : entityType === "receipt"
        ? `/admin/receipts/${entityId}`
        : `/admin/payments`;
  return rows.map((a) => ({
    id: a.id,
    at: new Date(a.createdAt),
    actor: a.actorName,
    action: a.action,
    entityType,
    entityRef: entityId.slice(0, 8),
    detail: auditDetail(a.action, a.after),
    href,
  }));
}

export type ActivityFilters = {
  entityType?: string;
  actor?: string;
  from?: Date;
  to?: Date;
  ref?: string;
  take?: number;
};

export async function getActivityFeed(filters: ActivityFilters = {}, db: ActivityDb = realDb): Promise<HistoryRow[]> {
  const take = Math.min(filters.take ?? 100, 200);
  const inRange = (d: Date) => {
    if (filters.from && d < filters.from) return false;
    if (filters.to && d > filters.to) return false;
    return true;
  };

  // Reference search resolves to entity ids first.
  let entityIds: { type: string; id: string; ref: string }[] | null = null;
  if (filters.ref?.trim()) {
    const q = filters.ref.trim();
    const [bookings, txns, payments, receipts] = await Promise.all([
      db.inspectionBooking.findMany({ where: { ref: { contains: q, mode: "insensitive" } }, select: { id: true, ref: true }, take: 20 }),
      db.transaction.findMany({ where: { ref: { contains: q, mode: "insensitive" } }, select: { id: true, ref: true }, take: 20 }),
      db.payment.findMany({
        where: { OR: [{ paymentReference: { contains: q, mode: "insensitive" } }] },
        select: { id: true, paymentReference: true },
        take: 20,
      }),
      db.receipt.findMany({ where: { ref: { contains: q, mode: "insensitive" } }, select: { id: true, ref: true }, take: 20 }),
    ]);
    entityIds = [
      ...bookings.map((b) => ({ type: "booking", id: b.id, ref: b.ref })),
      ...txns.map((t) => ({ type: "transaction", id: t.id, ref: t.ref })),
      ...payments.map((p) => ({ type: "payment", id: p.id, ref: p.paymentReference })),
      ...receipts.map((r) => ({ type: "receipt", id: r.id, ref: r.ref })),
    ];
    if (entityIds.length === 0) return [];
  }

  const actorWhere = filters.actor?.trim() ? { actorName: { contains: filters.actor.trim(), mode: "insensitive" as const } } : {};
  const rows: HistoryRow[] = [];

  const wantAudit = !filters.entityType || filters.entityType !== "booking";
  const wantBooking = !filters.entityType || filters.entityType === "booking";

  if (wantAudit) {
    const auditWhere: Record<string, unknown> = { ...actorWhere };
    if (filters.entityType) auditWhere.entityType = filters.entityType;
    if (entityIds) {
      const ids = entityIds.filter((e) => !filters.entityType || e.type === filters.entityType).map((e) => e.id);
      if (ids.length === 0) return rows;
      auditWhere.entityId = { in: ids };
    }
    const events = await db.auditEvent.findMany({ where: auditWhere, orderBy: { createdAt: "desc" }, take });
    const refById = new Map((entityIds ?? []).map((e) => [e.id, e.ref]));
    for (const a of events) {
      if (!inRange(new Date(a.createdAt))) continue;
      rows.push({
        id: a.id,
        at: new Date(a.createdAt),
        actor: a.actorName,
        action: a.action,
        entityType: a.entityType,
        entityRef: refById.get(a.entityId) ?? a.entityId.slice(0, 8),
        detail: auditDetail(a.action, a.after),
        href:
          a.entityType === "transaction"
            ? `/admin/transactions/${a.entityId}`
            : a.entityType === "receipt"
              ? `/admin/receipts/${a.entityId}`
              : "/admin/payments",
      });
    }
  }

  if (wantBooking) {
    const bookingWhere: Record<string, unknown> = { ...actorWhere };
    if (entityIds) {
      const ids = entityIds.filter((e) => e.type === "booking").map((e) => e.id);
      if (ids.length === 0) return rows.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, take);
      bookingWhere.bookingId = { in: ids };
    }
    const acts = await db.bookingActivity.findMany({ where: bookingWhere, orderBy: { createdAt: "desc" }, take });
    const refById = new Map((entityIds ?? []).map((e) => [e.id, e.ref]));
    for (const a of acts) {
      if (!inRange(new Date(a.createdAt))) continue;
      rows.push({
        id: a.id,
        at: new Date(a.createdAt),
        actor: a.actorName,
        action: a.action,
        entityType: "booking",
        entityRef: refById.get(a.bookingId) ?? a.bookingId.slice(0, 8),
        detail: a.note,
        href: `/admin/bookings/${a.bookingId}`,
      });
    }
  }

  return rows.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, take);
}
