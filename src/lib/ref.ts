import { prisma } from "@/lib/prisma";
import { randomInt } from "node:crypto";

// Reference numbers. New records use distinct prefixes per model so a ref is
// self-describing and collisions across tables are impossible by construction:
// BKG (bookings), TXN (transactions), PAY (payments), RCT (receipts).
// Existing BEL-YYYY-XXXXX refs are NEVER renamed (they are on sent emails and
// documents); search matches both formats via substring.
export type RefPrefix = "BKG" | "TXN" | "PAY" | "RCT" | "BEL";

export function prefixedRef(prefix: RefPrefix): string {
  const year = new Date().getFullYear();
  // crypto-secure 5-digit sequence (10000-99999); Math.random is predictable.
  const seq = randomInt(10000, 100000);
  return `${prefix}-${year}-${seq}`;
}

/** @deprecated BEL- namespace is frozen for legacy rows; use prefixedRef. */
export function generateRef(): string {
  return prefixedRef("BEL");
}

async function uniqueRef(prefix: RefPrefix, exists: (ref: string) => Promise<boolean>, label: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const ref = prefixedRef(prefix);
    if (!(await exists(ref))) return ref;
  }
  throw new Error(`Failed to generate a unique ${label} reference after 5 attempts`);
}

// check-then-insert is not atomic under concurrency: callers must also retry
// on the DB unique constraint (P2002) as the actual source of truth.
export async function generateUniqueBookingRef(): Promise<string> {
  return uniqueRef("BKG", async (ref) => !!(await prisma.inspectionBooking.findUnique({ where: { ref }, select: { id: true } })), "booking");
}

export async function generateUniqueTransactionRef(): Promise<string> {
  return uniqueRef("TXN", async (ref) => !!(await prisma.transaction.findUnique({ where: { ref }, select: { id: true } })), "transaction");
}

export async function generateUniquePaymentRef(): Promise<string> {
  return uniqueRef("PAY", async (ref) => !!(await prisma.payment.findFirst({ where: { paymentReference: ref }, select: { id: true } })), "payment");
}

export async function generateUniqueReceiptRef(): Promise<string> {
  return uniqueRef("RCT", async (ref) => !!(await prisma.receipt.findUnique({ where: { ref }, select: { id: true } })), "receipt");
}

/** @deprecated Bookings now use BKG- (generateUniqueBookingRef). */
export async function generateUniqueRef(): Promise<string> {
  return generateUniqueBookingRef();
}
