// Backfills canonical Customer records from existing bookings and
// transactions, then links customerId.
//
// Matching: normalized email first, then normalized phone. When the same
// email appears with different phones, both are linked and the extra phone
// goes to secondaryPhones. Same phone with a different email/name is a true
// conflict: listed for manual review, NOT merged (row left unlinked).
//
// Usage: npx tsx scripts/backfill-customers.ts [--apply]
// Default is --dry-run: prints every create/link/conflict. Nothing is written
// without --apply.
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { normalizeEmail, normalizeName, normalizePhoneE164 } from "../src/lib/phone.js";

const APPLY = process.argv.includes("--apply");

type Identity = {
  kind: "booking" | "transaction";
  id: string;
  ref: string;
  name: string;
  email: string;
  phone: string | null;
};

async function main() {
  const bookings = await prisma.inspectionBooking.findMany({
    select: { id: true, ref: true, name: true, email: true, phone: true, createdAt: true },
  });
  const transactions = await prisma.transaction.findMany({
    select: { id: true, ref: true, customerName: true, customerEmail: true, customerPhone: true, createdAt: true },
  });
  const identities: Identity[] = [
    ...bookings.map((b) => ({ kind: "booking" as const, id: b.id, ref: b.ref, name: b.name, email: b.email, phone: b.phone })),
    ...transactions.map((t) => ({
      kind: "transaction" as const,
      id: t.id,
      ref: t.ref,
      name: t.customerName,
      email: t.customerEmail,
      phone: t.customerPhone,
    })),
  ];

  const customers = new Map<string, { id: string | null; name: string; email: string; phones: Set<string> }>();
  const conflicts: string[] = [];
  const links: { kind: string; id: string; ref: string; email: string }[] = [];

  for (const ident of identities) {
    const name = normalizeName(ident.name) ?? ident.name;
    const email = normalizeEmail(ident.email);
    const phone = normalizePhoneE164(ident.phone);
    if (!email) {
      conflicts.push(`SKIP ${ident.kind} ${ident.ref}: no usable email`);
      continue;
    }
    const existing = customers.get(email);
    if (existing) {
      if (phone) existing.phones.add(phone);
      links.push({ kind: ident.kind, id: ident.id, ref: ident.ref, email });
      continue;
    }
    // Phone cross-check: same phone, different email → conflict, don't merge.
    const clash = [...customers.entries()].find(
      ([otherEmail, c]) => otherEmail !== email && phone && [...c.phones].some((p) => p === phone)
    );
    if (clash) {
      conflicts.push(
        `CONFLICT ${ident.kind} ${ident.ref} (${name} <${email}> ${phone ?? "no-phone"}) shares phone ${phone} with <${clash[0]}> — left unlinked for review`
      );
      continue;
    }
    customers.set(email, { id: null, name, email, phones: new Set(phone ? [phone] : []) });
    links.push({ kind: ident.kind, id: ident.id, ref: ident.ref, email });
  }

  console.log(`[dry-run=${!APPLY}] ${identities.length} identities → ${customers.size} customers, ${conflicts.length} conflicts`);
  for (const [email, c] of customers) {
    console.log(`  CUSTOMER ${c.name} <${email}> phones=[${[...c.phones].join(", ") || "—"}] secondary=[${[...c.phones].slice(1).join(", ") || "—"}]`);
  }
  for (const l of links) console.log(`  LINK ${l.kind} ${l.ref} → <${l.email}>`);
  for (const c of conflicts) console.log(`  ${c}`);

  if (APPLY) {
    for (const [email, c] of customers) {
      const [primary, ...rest] = [...c.phones];
      const created = await prisma.customer.create({
        data: { name: c.name, email, phone: primary ?? null, secondaryPhones: rest },
      });
      c.id = created.id;
    }
    for (const l of links) {
      const id = customers.get(l.email)?.id;
      if (!id) continue;
      if (l.kind === "booking") await prisma.inspectionBooking.update({ where: { id: l.id }, data: { customerId: id } });
      else await prisma.transaction.update({ where: { id: l.id }, data: { customerId: id } });
    }
    console.log(`Applied: ${customers.size} customers created, ${links.length} rows linked.`);
  } else {
    console.log("Dry run complete — re-run with --apply to write changes.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
