import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public for site booking form datalist: only name + category, no contact PII needed for tally suggestions.
export async function GET() {
  const agents = await prisma.agent.findMany({
    where: { isActive: true },
    select: { name: true, category: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ agents });
}
