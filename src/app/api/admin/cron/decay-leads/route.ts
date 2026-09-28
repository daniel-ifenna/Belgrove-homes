import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Hot → warm after 30 days with no logged contact (no message, note, or status change).
// Behind the admin middleware (see src/proxy.ts) like every /api/admin route.
async function findDecayed(cutoff: Date): Promise<string[]> {
  const hots = await prisma.inspectionBooking.findMany({
    where: { leadTemperature: "hot", status: { not: "closed" } },
    select: { id: true, leadTemperature: true, updatedAt: true, status: true },
  });

  const decayed: string[] = [];
  for (const b of hots) {
    // Check last timeline entry across messages, notes, activities
    const [lastMsg, lastNote, lastActivity] = await Promise.all([
      prisma.bookingMessage.findFirst({ where: { bookingId: b.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      prisma.internalNote.findFirst({ where: { bookingId: b.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      prisma.bookingActivity.findFirst({ where: { bookingId: b.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    ]);
    const lastContact = [lastMsg?.createdAt, lastNote?.createdAt, lastActivity?.createdAt].filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] as Date | undefined;
    const last = lastContact ?? b.updatedAt;
    if (last < cutoff) decayed.push(b.id);
  }

  return decayed;
}

export async function POST() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ids = await findDecayed(cutoff);
  let decayed = 0;
  for (const id of ids) {
    const b = await prisma.inspectionBooking.findUnique({ where: { id }, select: { status: true } });
    if (!b) continue;
    await prisma.inspectionBooking.update({ where: { id }, data: { leadTemperature: "warm" } });
    await prisma.bookingActivity.create({
      data: {
        bookingId: id,
        actorId: null,
        actorName: "System",
        action: "cool_down",
        fromStatus: b.status,
        toStatus: b.status,
        note: "hot → warm (auto-decay after 30 days with no contact)",
      },
    });
    decayed++;
  }

  return NextResponse.json({ decayed, cutoff: cutoff.toISOString() });
}

export async function GET() {
  // Read-only dry run: reports what POST would decay, changes nothing.
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ids = await findDecayed(cutoff);
  return NextResponse.json({ wouldDecay: ids.length, cutoff: cutoff.toISOString() });
}
