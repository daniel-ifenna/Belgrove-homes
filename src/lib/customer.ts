import { prisma } from "@/lib/prisma";
import { normalizeEmail, normalizeName, normalizePhoneE164, phonesMatch } from "@/lib/phone";

// Canonical customer management. New bookings and transactions find-or-create
// a Customer by normalized email first, then phone:
// - email match → reuse; a different phone is appended to secondaryPhones.
// - phone-only match → reuse (shared handset, e.g. family).
// - no match → create.
// Names are trimmed + whitespace-collapsed on input and stored as-entered
// (never re-cased). Emails are lowercased+trimmed, phones E.164.

export type CustomerInput = {
  name: string;
  email: string;
  phone?: string | null;
};

export type CustomerDb = {
  customer: {
    findFirst(args: unknown): Promise<{
      id: string;
      name: string;
      email: string;
      phone: string | null;
      secondaryPhones: string[];
    } | null>;
    create(args: unknown): Promise<{ id: string }>;
    update(args: unknown): Promise<unknown>;
  };
};

const realDb = prisma as unknown as CustomerDb;

export function normalizeCustomerInput(input: CustomerInput): { name: string; email: string; phone: string | null } {
  const name = normalizeName(input.name) ?? "";
  const email = normalizeEmail(input.email) ?? "";
  const phone = normalizePhoneE164(input.phone);
  if (!name) throw new Error("Customer name is required");
  if (!email) throw new Error("Customer email is required");
  return { name, email, phone };
}

export async function findOrCreateCustomer(input: CustomerInput, db: CustomerDb = realDb): Promise<{ id: string }> {
  const { name, email, phone } = normalizeCustomerInput(input);

  const byEmail = await db.customer.findFirst({ where: { email } });
  if (byEmail) {
    const extras = new Set(byEmail.secondaryPhones ?? []);
    if (byEmail.phone && phone && byEmail.phone !== phone && !phonesMatch(byEmail.phone, phone)) extras.add(phone);
    if (phone && !byEmail.phone) {
      await db.customer.update({ where: { id: byEmail.id }, data: { phone, secondaryPhones: [...extras] } });
    } else if (extras.size !== (byEmail.secondaryPhones ?? []).length) {
      await db.customer.update({ where: { id: byEmail.id }, data: { secondaryPhones: [...extras] } });
    }
    return { id: byEmail.id };
  }

  if (phone) {
    const byPhone = await db.customer.findFirst({
      where: { OR: [{ phone }, { secondaryPhones: { has: phone } }] },
    });
    if (byPhone) return { id: byPhone.id };
  }

  const created = await db.customer.create({ data: { name, email, phone } });
  return { id: created.id };
}

// Test-data propagation (scripts/mark-test-data.ts): a customer is flagged
// isTest when it has at least one linked record and every linked record is
// itself flagged isTest. Unlinked or mixed customers stay real.
export function customerShouldBeTest(linkedIsTestFlags: boolean[]): boolean {
  return linkedIsTestFlags.length > 0 && linkedIsTestFlags.every(Boolean);
}
