import { describe, it, expect } from "vitest";
import { findOrCreateCustomer, type CustomerDb } from "../customer";
import { normalizeEmail, normalizeName, normalizePhoneE164, phonesMatch } from "../phone";

type Row = { id: string; name: string; email: string; phone: string | null; secondaryPhones: string[] };
type FindArgs = { where: { email?: string; OR?: { phone?: string; secondaryPhones?: { has?: string } }[] } };

function mockDb(initial: Row[] = []) {
  const rows: Row[] = [...initial];
  const calls: string[] = [];
  const db: CustomerDb = {
    customer: {
      findFirst: async (args: FindArgs) => {
        calls.push(`find:${JSON.stringify(args.where)}`);
        const w = args.where;
        if (w.email) return rows.find((r) => r.email === w.email) ?? null;
        if (w.OR) {
          return (
            rows.find((r) =>
              w.OR!.some((c) => (c.phone && r.phone === c.phone) || (c.secondaryPhones?.has && r.secondaryPhones.includes(c.secondaryPhones.has)))
            ) ?? null
          );
        }
        return null;
      },
      create: async (args: { data: { name: string; email: string; phone: string | null } }) => {
        calls.push(`create:${JSON.stringify(args.data)}`);
        const row: Row = { id: `c${rows.length + 1}`, secondaryPhones: [], ...args.data };
        rows.push(row);
        return { id: row.id };
      },
      update: async (args: { where: { id: string }; data: Partial<Row> }) => {
        calls.push(`update:${JSON.stringify(args.data)}`);
        const row = rows.find((r) => r.id === args.where.id)!;
        Object.assign(row, args.data);
        return row;
      },
    },
  };
  return { db, rows, calls };
}

describe("customer normalization", () => {
  it("email lowercases+trims, phone E.164s, name collapses whitespace (stored as-entered)", () => {
    expect(normalizeEmail("  Daniel.Ifenna@Gmail.com ")).toBe("daniel.ifenna@gmail.com");
    expect(normalizePhoneE164("+234 815 480 4158")).toBe("+2348154804158");
    expect(normalizePhoneE164("08154804158")).toBe("+2348154804158");
    expect(normalizePhoneE164("8154804158")).toBe("+2348154804158");
    expect(normalizeName("  DANIEL   IFENNA  ")).toBe("DANIEL IFENNA");
    expect(phonesMatch("+2348154804158", "08154804158")).toBe(true);
  });
});

describe("findOrCreateCustomer", () => {
  it("creates with normalized fields on first sight", async () => {
    const { db, rows } = mockDb();
    const out = await findOrCreateCustomer({ name: "  Daniel   Ifenna ", email: "Daniel@Example.COM", phone: "08154804158" }, db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Daniel Ifenna", email: "daniel@example.com", phone: "+2348154804158" });
    expect(out.id).toBe(rows[0].id);
  });

  it("email match reuses and appends a different phone to secondaryPhones", async () => {
    const { db, rows } = mockDb([
      { id: "c1", name: "Daniel Ifenna", email: "daniel.ifenna.daniel@gmail.com", phone: "+2348154804158", secondaryPhones: [] },
    ]);
    const out = await findOrCreateCustomer(
      { name: "Daniel Ifenna", email: "DANIEL.IFENNA.DANIEL@GMAIL.COM", phone: "+2347014380883" },
      db
    );
    expect(out.id).toBe("c1");
    expect(rows).toHaveLength(1);
    expect(rows[0].secondaryPhones).toEqual(["+2347014380883"]);
  });

  it("same-format phone match does not duplicate secondaryPhones", async () => {
    const { db, rows } = mockDb([
      { id: "c1", name: "A", email: "a@x.com", phone: "+2348154804158", secondaryPhones: [] },
    ]);
    await findOrCreateCustomer({ name: "A", email: "a@x.com", phone: "08154804158" }, db);
    expect(rows[0].secondaryPhones).toEqual([]);
  });

  it("fills a missing phone on email match", async () => {
    const { db, rows } = mockDb([{ id: "c1", name: "B", email: "b@x.com", phone: null, secondaryPhones: [] }]);
    await findOrCreateCustomer({ name: "B", email: "b@x.com", phone: "08031234567" }, db);
    expect(rows[0].phone).toBe("+2348031234567");
  });

  it("rejects blank name/email loudly", async () => {
    const { db } = mockDb();
    await expect(findOrCreateCustomer({ name: "  ", email: "a@x.com" }, db)).rejects.toThrow(/name/i);
    await expect(findOrCreateCustomer({ name: "A", email: "  " }, db)).rejects.toThrow(/email/i);
  });
});
