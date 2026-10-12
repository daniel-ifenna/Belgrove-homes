import { describe, it, expect } from "vitest";
import { getEntityHistory, getActivityFeed, getTransactionHistory, describeAuditAction } from "../activity";

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

  it("renders human sentences instead of raw event keys", async () => {
    const rows = await getEntityHistory("payment", "p1", fakeDb() as never);
    expect(rows[0].action).toBe("Payment of ₦1,450,000 confirmed");
    expect(describeAuditAction("payment.correct", { amount: 3_000_000, reason: "typo" }, { amount: 3_250_000 })).toBe(
      "Payment of ₦3,250,000 corrected to ₦3,000,000: typo"
    );
    expect(
      describeAuditAction(
        "payment.correct",
        { amount: 3_000_000, reason: "typo", originalReceiptRef: "RCT-2026-69739", replacementReceiptRef: "RCT-2026-00001" },
        { amount: 3_250_000 }
      )
    ).toBe(
      "Payment of ₦3,250,000 corrected to ₦3,000,000, receipt RCT-2026-69739 voided, replacement RCT-2026-00001 issued: typo"
    );
    expect(describeAuditAction("payment.void", { amount: 1, reason: "dup" }, null)).toBe("Payment of ₦1 voided: dup");
    expect(describeAuditAction("transaction.create", {}, null)).toBe("Transaction created");
    expect(describeAuditAction("statement.email", { to: "c@x.com" }, null)).toBe("Statement emailed to c@x.com");
    expect(describeAuditAction("contract.set_date", {}, null)).toBe("Contract date set");
    expect(describeAuditAction("something.unknown", {}, null)).toBe("something.unknown");
  });

  it("transaction history includes payment, receipt and statement events", async () => {
    const db = {
      ...fakeDb(),
      payment: { findMany: async () => [{ id: "p1" }] },
      receipt: { findMany: async () => [{ id: "r9" }] },
      statement: { findMany: async () => [{ id: "s1" }] },
      auditEvent: {
        findMany: async (args: { where: { entityId?: { in?: string[] } } }) => {
          const all = [
            { id: "a1", actorName: "A", action: "transaction.create", entityType: "transaction", entityId: "t1", before: null, after: {}, createdAt: new Date() },
            { id: "a2", actorName: "A", action: "payment.confirm", entityType: "payment", entityId: "p1", before: null, after: { amount: 5 }, createdAt: new Date() },
            { id: "a3", actorName: "A", action: "receipt.send", entityType: "receipt", entityId: "r9", before: null, after: {}, createdAt: new Date() },
            { id: "a4", actorName: "A", action: "statement.generate", entityType: "statement", entityId: "s1", before: null, after: { number: "STM-1" }, createdAt: new Date() },
            { id: "a5", actorName: "A", action: "payment.confirm", entityType: "payment", entityId: "other", before: null, after: {}, createdAt: new Date() },
          ];
          const ids = args.where.entityId?.in ?? [];
          return all.filter((r) => ids.includes(r.entityId));
        },
      },
    };
    const rows = await getTransactionHistory("t1", db as never);
    expect(rows.map((r) => r.id).sort()).toEqual(["a1", "a2", "a3", "a4"]);
    expect(rows.find((r) => r.id === "a4")?.action).toBe("Statement STM-1 generated");
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
