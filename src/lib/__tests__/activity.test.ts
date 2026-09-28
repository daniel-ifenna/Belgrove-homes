import { describe, it, expect } from "vitest";
import { getEntityHistory, getActivityFeed } from "../activity";

function fakeDb() {
  return {
    auditEvent: {
      findMany: async (args: { where: { entityType?: string; entityId?: unknown; actorName?: unknown } }) => {
        const rows = [
          {
            id: "a1", actorName: "Ada Admin", action: "payment.confirm", entityType: "payment", entityId: "p1",
            before: null, after: { status: "CONFIRMED", amount: 1_450_000 }, createdAt: new Date("2026-09-26T10:00:00Z"),
          },
          {
            id: "a2", actorName: "Ada Admin", action: "payment.void", entityType: "payment", entityId: "p2",
            before: { status: "CONFIRMED" }, after: { status: "CANCELLED" }, createdAt: new Date("2026-09-27T10:00:00Z"),
          },
        ];
        return rows.filter((r) => {
          if (args.where.entityType && r.entityType !== args.where.entityType) return false;
          if (args.where.entityId && typeof args.where.entityId === "string" && r.entityId !== args.where.entityId) return false;
          if (args.where.entityId && typeof args.where.entityId === "object") {
            const ids = (args.where.entityId as { in?: string[] }).in ?? [];
            if (!ids.includes(r.entityId)) return false;
          }
          return true;
        });
      },
    },
    bookingActivity: {
      findMany: async (args: { where: { bookingId?: unknown } }) => {
        const rows = [
          {
            id: "b1", bookingId: "bk1", actorName: "Ada Admin", action: "approve",
            note: "Approved", createdAt: new Date("2026-09-25T10:00:00Z"),
          },
        ];
        const w = args.where.bookingId;
        if (typeof w === "string") return rows.filter((r) => r.bookingId === w);
        if (w && typeof w === "object" && "in" in (w as object)) {
          const ids = ((w as { in?: string[] }).in ?? []);
          return rows.filter((r) => ids.includes(r.bookingId));
        }
        return rows;
      },
    },
    inspectionBooking: {
      findMany: async (args: { where: { ref?: { contains?: string } } }) => {
        const all = [{ id: "bk1", ref: "BKG-1" }];
        const q = args.where.ref?.contains ?? "";
        return all.filter((b) => b.ref.includes(q));
      },
    },
    transaction: { findMany: async () => [] },
    payment: {
      findMany: async (args: { where: { OR?: { paymentReference?: { contains?: string } }[] } }) => {
        const all = [{ id: "p1", paymentReference: "PAY-1", transactionId: "t1" }];
        const ors = args.where.OR ?? [];
        return all.filter((p) => ors.every((c) => !c.paymentReference?.contains || p.paymentReference.includes(c.paymentReference.contains)));
      },
    },
    receipt: { findMany: async () => [] },
  };
}

describe("getEntityHistory", () => {
  it("returns booking activity for bookings", async () => {
    const rows = await getEntityHistory("booking", "bk1", fakeDb() as never);
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe("approve");
    expect(rows[0].href).toBe("/admin/bookings/bk1");
  });

  it("returns audit events for payments with detail", async () => {
    const rows = await getEntityHistory("payment", "p1", fakeDb() as never);
    expect(rows).toHaveLength(1);
    expect(rows[0].detail).toContain("CONFIRMED");
  });
});

describe("getActivityFeed", () => {
  it("merges both sources newest-first", async () => {
    const rows = await getActivityFeed({}, fakeDb() as never);
    expect(rows.map((r) => r.id)).toEqual(["a2", "a1", "b1"]);
  });

  it("filters by entity type and reference", async () => {
    const byType = await getActivityFeed({ entityType: "payment" }, fakeDb() as never);
    expect(byType.every((r) => r.entityType === "payment")).toBe(true);
    const byRef = await getActivityFeed({ ref: "PAY-1" }, fakeDb() as never);
    expect(byRef.map((r) => r.id)).toEqual(["a1"]);
    const none = await getActivityFeed({ ref: "NOPE" }, fakeDb() as never);
    expect(none).toEqual([]);
  });
});
