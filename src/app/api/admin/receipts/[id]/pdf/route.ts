import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { receiptPdfAbsolute } from "@/lib/receipt-storage";

// Admin-only receipt PDF download (accepts receipt id or ref). Client PDFs
// live in private storage (storage/receipts/) and are never served statically.
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const receipt = await prisma.receipt.findFirst({
    where: { OR: [{ id }, { ref: id }] },
    select: { ref: true, pdfPath: true },
  });
  if (!receipt?.pdfPath) {
    return NextResponse.json({ error: "PDF not yet generated" }, { status: 404 });
  }
  const filePath = receiptPdfAbsolute(receipt.pdfPath);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "PDF not yet generated" }, { status: 404 });
  }
  const buf = fs.readFileSync(filePath);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Belgrove-Receipt-${receipt.ref}.pdf"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
