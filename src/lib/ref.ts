import { prisma } from "@/lib/prisma";
import { randomInt } from "node:crypto";

export function generateRef(): string {
  const year = new Date().getFullYear();
  // crypto-secure 5-digit sequence (10000-99999) Math.random is predictable
  const seq = randomInt(10000, 100000);
  return `BEL-${year}-${seq}`;
}

export async function generateUniqueRef(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const ref = generateRef();
    const existing = await prisma.inspectionBooking.findUnique({
      where: { ref },
      select: { id: true },
    });
    if (!existing) return ref;
  }
  throw new Error("Failed to generate a unique booking reference after 5 attempts");
}
