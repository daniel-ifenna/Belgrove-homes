import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";

export const dynamic = "force-dynamic";

// Serve one stored (immutable) statement's PDF — View and Download read the
// same bytes (?download=1 forces attachment disposition). Never generates,
// never emails.
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string; statementId: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, statementId } = await ctx.params;
  const row = await prisma.statement.findFirst({
    where: { id: statementId, transactionId: id },
    select: { number: true, pdfData: true },
  });
  if (!row) return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(Buffer.from(row.pdfData)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="Belgrove-${row.number}.pdf"`,
      "Cache-Control": "private, no-store, must-revalidate",
    },
  });
}
