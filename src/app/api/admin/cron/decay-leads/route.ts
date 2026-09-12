import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Hot → warm after 30 days with no logged contact (no message, note, or status change)
export async function POST() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const hots = await prisma.inspectionBooking.findMany({
    where: { leadTemperature: "hot", status: { not: "closed" } },
    select: { id: true, leadTemperature: true, updatedAt: true, status: true },
  });

  let decayed = 0;
  for (const b of hots) {
    // Check last timeline entry across messages, notes, activities
    const [lastMsg, lastNote, lastActivity] = await Promise.all([
      prisma.bookingMessage.findFirst({ where: { bookingId: b.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      prisma.internalNote.findFirst({ where: { bookingId: b.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      prisma.bookingActivity.findFirst({ where: { bookingId: b.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    ]);
    const lastContact = [lastMsg?.createdAt, lastNote?.createdAt, lastActivity?.createdAt].filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] as Date | undefined;
    const last = lastContact ?? b.updatedAt;
    if (last < cutoff) {
      await prisma.inspectionBooking.update({ where: { id: b.id }, data: { leadTemperature: "warm" } });
      await prisma.bookingActivity.create({
        data: {
          bookingId: b.id,
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
  }

  return NextResponse.json({ decayed, checked: hots.length, cutoff: cutoff.toISOString() });
}

export async function GET() {
  // Allow manual check via GET for admin visibility
  return POST();
}
