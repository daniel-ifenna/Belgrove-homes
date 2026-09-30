import { describe, it, expect } from "vitest";
import { getActionItems, getActionCounts, getInboxBookingIds, ageString, type InboxDb } from "../inbox";

const NOW = new Date("2026-09-28T12:00:00Z");

type State = {
  payments: { id: string; amount: number; paymentReference: string; transactionId: string; status: string; createdAt: Date; txn: { id: string; ref: string; customerName: string } | null; isTestTxn: boolean }[];
  outbox: { id: string; relatedId: string | null; status: string; updatedAt: Date; createdAt: Date; type?: string; to?: unknown; relatedType?: string | null }[];
  receipts: { id: string; ref: string; customerName: string; finalAmount: number }[];
  bookings: {
    id: string; ref: string; name: string; location: string; estate: string | null;
    status: string; outcome: string | null; agentId: string | null;
    inspectedAt: Date | null; preferredDate: Date; rescheduledDate: Date | null;
    createdAt: Date; updatedAt: Date; hasTxn: boolean; isTest: boolean;
  }[];
  txns: { id: string; ref: string; customerName: string }[];
};

function seed(): State {
  return {
    payments: [
      {
        id: "p1", amount: 1_450_000, paymentReference: "PAY-1", transactionId: "t1", status: "PENDING_VERIFICATION",
        createdAt: new Date("2026-09-26T10:00:00Z"),
        txn: { id: "t1", ref: "TXN-1", customerName: "Ada" }, isTestTxn: false,
      },
    ],
    outbox: [
      { id: "o1", relatedId: "r1", status: "FAILED", updatedAt: new Date("2026-09-27T10:00:00Z"), createdAt: new Date("2026-09-27T09:00:00Z") },
    ],
    receipts: [{ id: "r1", ref: "RCT-1", customerName: "Ada", finalAmount: 1_450_000 }],
    bookings: [
      {
        id: "b1", ref: "BKG-1", name: "Ada", location: "Estate", estate: null,
        status: "closed", outcome: "sold", agentId: "a1",
        inspectedAt: new Date("2026-09-20T10:00:00Z"), preferredDate: new Date("2026-09-20T00:00:00Z"), rescheduledDate: null,
        createdAt: new Date("2026-09-10T00:00:00Z"), updatedAt: new Date("2026-09-20T00:00:00Z"), hasTxn: false, isTest: false,
      },
      {
        id: "b2", ref: "BKG-2", name: "Bola", location: "Estate", estate: null,
        status: "new", outcome: null, agentId: null,
        inspectedAt: null, preferredDate: new Date("2026-10-05T00:00:00Z"), rescheduledDate: null,
        createdAt: new Date("2026-09-27T00:00:00Z"), updatedAt: new Date("2026-09-27T00:00:00Z"), hasTxn: false, isTest: false,
      },
      {
        id: "b3", ref: "BKG-3", name: "Test", location: "Estate", estate: null,
        status: "new", outcome: null, agentId: null,
        inspectedAt: null, preferredDate: new Date("2026-10-05T00:00:00Z"), rescheduledDate: null,
        createdAt: new Date("2026-09-27T00:00:00Z"), updatedAt: new Date("2026-09-27T00:00:00Z"), hasTxn: false, isTest: true,
      },
    ],
    txns: [{ id: "t1", ref: "TXN-1", customerName: "Ada" }],
  };
}

type Where = {
  isTest?: boolean;
  status?: string | { in?: string[]; not?: string };
  outcome?: string | null;
  agentId?: string | null;
  inspectedAt?: unknown;
  transaction?: { isTest?: boolean } | null;
  id?: { in?: string[] } | null;
  createdAt?: { lt?: Date };
};

function statusIn(where: Where): string[] | null {
  const st = where.status;
  if (typeof st === "string") return [st];
  return st?.in ?? null;
}

function statusNot(where: Where): string | null {
  const st = where.status;
  return typeof st === "object" && st !== null ? (st.not ?? null) : null;
}

function matchOutboxRows(s: State, where: Where) {
  return s.outbox.filter((o) => {
    const st = where.status;
    if (typeof st === "string") {
      if (o.status !== st) return false;
    } else if (st && typeof st === "object" && st.in) {
      if (!st.in.includes(o.status)) return false;
    }
    if (where.createdAt?.lt && !(o.createdAt < where.createdAt.lt)) return false;
    return true;
  });
}

function fakeDb(s: State): InboxDb {
  const liveBookings = (where: Where) =>
    s.bookings.filter((b) => {
      if (where.isTest === false && b.isTest) return false;
      const ins = statusIn(where);
      if (ins && !ins.includes(b.status)) return false;
      const not = statusNot(where);
      if (not && b.status === not) return false;
      if (where.outcome !== undefined && b.outcome !== where.outcome) return false;
      if ("agentId" in where && where.agentId === null && b.agentId !== null) return false;
      if (where.inspectedAt && b.inspectedAt === null) return false;
      if (where.transaction === null && b.hasTxn) return false;
      return true;
    });
  return {
    payment: {
      findMany: async (args: { where: Where }) => {
        const rows = s.payments.filter((p) => {
          if (typeof args.where.status === "string" && p.status !== args.where.status) return false;
          const txf = args.where.transaction;
          if (txf && typeof txf === "object" && txf.isTest === false && p.isTestTxn) return false;
          return true;
        });
        return rows.map((p) => ({
          id: p.id, amount: p.amount, paymentReference: p.paymentReference,
          transactionId: p.transactionId, createdAt: p.createdAt, transaction: p.txn,
        }));
      },
      count: async (args: { where: Where }) =>
        s.payments.filter((p) => {
          if (typeof args.where.status === "string" && p.status !== args.where.status) return false;
          const txf = args.where.transaction;
          if (txf && typeof txf === "object" && txf.isTest === false && p.isTestTxn) return false;
          return true;
        }).length,
    },
    emailOutbox: {
      findMany: async (args: { where: Where }) => matchOutboxRows(s, args.where).map((o) => ({ ...o })),
      count: async (args: { where: Where }) => matchOutboxRows(s, args.where).length,
    },
    receipt: {
      findMany: async (args: { where: Where }) => {
        const ids = typeof args.where.id === "object" && args.where.id !== null ? (args.where.id.in ?? []) : [];
        return s.receipts.filter((r) => ids.includes(r.id));
      },
    },
    inspectionBooking: {
      findMany: async (args: { where: Where; take?: number }) => liveBookings(args.where).slice(0, args.take ?? 50),
      count: async (args: { where: Where }) => liveBookings(args.where).length,
    },
    transaction: {
      findMany: async (args: { where: Where }) => {
        const ids = typeof args.where.id === "object" && args.where.id !== null ? (args.where.id.in ?? []) : [];
        return s.txns.filter((t) => ids.includes(t.id));
      },
    },
  };
}

describe("inbox items", () => {
  const hermetic = { overdue: [] as never[] };
  it("each category appears when its condition is true", async () => {
    const items = await getActionItems({ db: fakeDb(seed()), now: NOW, ...hermetic });
    const cats = items.map((i) => i.category);
    expect(cats).toContain("PAYMENT_PENDING_VERIFICATION");
    expect(cats).toContain("RECEIPT_SEND_FAILED");
    expect(cats).toContain("SOLD_WITHOUT_TRANSACTION");
    expect(cats).toContain("BOOKING_NEW");
    expect(cats).toContain("BOOKING_UNASSIGNED");
    // b1 is sold+closed: no awaiting-outcome; add coverage below.
    expect(items[0].priority).toBe(1);
    for (const i of items) {
      expect(i.ref).toBeTruthy();
      expect(i.title).toBeTruthy();
      expect(i.actionLabel).toBeTruthy();
      expect(i.href).toMatch(/^\/admin\//);
    }
  });

  it("stuck unsent mail appears as EMAIL_STUCK; fresh queue does not", async () => {
    const s = seed();
    // Unsent for over an hour → stuck (links to the receipt for resend context).
    s.outbox.push({
      id: "o2", relatedId: "r1", relatedType: "receipt", type: "receipt", to: "client@x.com",
      status: "PENDING", updatedAt: new Date("2026-09-28T11:00:00Z"), createdAt: new Date("2026-09-28T11:00:00Z"),
    });
    // Enqueued a minute ago → still normal, not stuck.
    s.outbox.push({
      id: "o3", relatedId: null, relatedType: "booking", type: "booking_received", to: "fresh@x.com",
      status: "PENDING", updatedAt: new Date("2026-09-28T11:59:00Z"), createdAt: new Date("2026-09-28T11:59:00Z"),
    });
    const items = await getActionItems({ db: fakeDb(s), now: NOW, overdue: [] });
    const stuck = items.filter((i) => i.category === "EMAIL_STUCK");
    expect(stuck).toHaveLength(1);
    expect(stuck[0].id).toBe("stuck-o2");
    expect(stuck[0].href).toBe("/admin/receipts/r1");
    expect(stuck[0].ref).toBe("receipt");
    const counts = await getActionCounts({ db: fakeDb(s), now: NOW, overdue: [] });
    expect(counts.byCategory.EMAIL_STUCK).toBe(1);
  });

  it("pending item disappears on confirm or void", async () => {
    const s = seed();
    let items = await getActionItems({ db: fakeDb(s), now: NOW, overdue: [] });
    expect(items.filter((i) => i.category === "PAYMENT_PENDING_VERIFICATION")).toHaveLength(1);
    s.payments[0].status = "CONFIRMED"; // confirm
    items = await getActionItems({ db: fakeDb(s), now: NOW, overdue: [] });
    expect(items.filter((i) => i.category === "PAYMENT_PENDING_VERIFICATION")).toHaveLength(0);
    s.payments[0].status = "CANCELLED"; // void path behaves the same
    items = await getActionItems({ db: fakeDb(s), now: NOW, overdue: [] });
    expect(items.filter((i) => i.category === "PAYMENT_PENDING_VERIFICATION")).toHaveLength(0);
  });

  it("sold item disappears once the transaction is linked", async () => {
    const s = seed();
    let items = await getActionItems({ db: fakeDb(s), now: NOW, overdue: [] });
    expect(items.filter((i) => i.category === "SOLD_WITHOUT_TRANSACTION")).toHaveLength(1);
    s.bookings[0].hasTxn = true;
    items = await getActionItems({ db: fakeDb(s), now: NOW, overdue: [] });
    expect(items.filter((i) => i.category === "SOLD_WITHOUT_TRANSACTION")).toHaveLength(0);
  });

  it("new/unassigned disappear on review/assign; awaiting appears and clears on outcome", async () => {
    const s = seed();
    s.bookings.push({
      id: "b4", ref: "BKG-4", name: "Cara", location: "Estate", estate: null,
      status: "active", outcome: null, agentId: "a1",
      inspectedAt: new Date("2026-09-27T10:00:00Z"), preferredDate: new Date("2026-09-27T00:00:00Z"), rescheduledDate: null,
      createdAt: new Date("2026-09-20T00:00:00Z"), updatedAt: new Date("2026-09-27T00:00:00Z"), hasTxn: false, isTest: false,
    });
    let items = await getActionItems({ db: fakeDb(s), now: NOW, overdue: [] });
    expect(items.filter((i) => i.category === "INSPECTION_AWAITING_OUTCOME")).toHaveLength(1);
    s.bookings[1].status = "under_review"; // reviewed
    s.bookings[1].agentId = "a9"; // assigned
    s.bookings[3].outcome = "sold"; // outcome recorded
    items = await getActionItems({ db: fakeDb(s), now: NOW, overdue: [] });
    expect(items.filter((i) => i.category === "BOOKING_NEW").map((x) => x.ref)).not.toContain("BKG-2");
    expect(items.filter((i) => i.category === "BOOKING_UNASSIGNED").map((x) => x.ref)).not.toContain("BKG-2");
    expect(items.filter((i) => i.category === "INSPECTION_AWAITING_OUTCOME")).toHaveLength(0);
  });

  it("test records never appear", async () => {
    const items = await getActionItems({ db: fakeDb(seed()), now: NOW, overdue: [] });
    expect(items.map((i) => i.ref)).not.toContain("BKG-3");
    const counts = await getActionCounts({ db: fakeDb(seed()), overdue: [] });
    expect(counts.byCategory.BOOKING_NEW).toBe(1); // BKG-2 only, not BKG-3
  });

  it("counts match list lengths", async () => {
    const db = fakeDb(seed());
    const items = await getActionItems({ db, now: NOW, overdue: [] });
    const counts = await getActionCounts({ db: fakeDb(seed()), overdue: [] });
    for (const c of Object.keys(counts.byCategory) as (keyof typeof counts.byCategory)[]) {
      if (c === "INSTALLMENT_OVERDUE" || c === "INSPECTION_DUE_TODAY") continue; // money/time dependent
      expect(items.filter((i) => i.category === c)).toHaveLength(counts.byCategory[c]);
    }
    expect(counts.total).toBe(Object.values(counts.byCategory).reduce((s, n) => s + n, 0));
  });
});

describe("getInboxBookingIds", () => {
  it("contains bookings with open items only (drives notification resolution)", async () => {
    const ids = await getInboxBookingIds({ db: fakeDb(seed()) });
    expect(ids.has("b2")).toBe(true); // new + unassigned
    expect(ids.has("b1")).toBe(true); // sold without transaction
    expect(ids.has("b3")).toBe(false); // test fixture
    expect(ids.has("closed-quiet")).toBe(false);
  });
});

describe("ageString", () => {
  it("formats minutes, hours, days", () => {
    expect(ageString(NOW, NOW)).toBe("just now");
    expect(ageString(new Date(NOW.getTime() - 5 * 60000), NOW)).toBe("5 min");
    expect(ageString(new Date(NOW.getTime() - 3 * 3600000), NOW)).toBe("3 hr");
    expect(ageString(new Date(NOW.getTime() - 2 * 86400000), NOW)).toBe("2 days");
  });
});
