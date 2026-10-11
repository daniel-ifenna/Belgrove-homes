import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { renderReceiptPdfBuffer } from "@/lib/receipt-render";
import { logServerError } from "@/lib/paymentConfirmation";

// Admin-only receipt PDF download (accepts receipt id or ref). Reuses the
// stored bytes generated once at confirmation; renders and stores only when
// missing (legacy rows). No filesystem.
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const receipt = await prisma.receipt.findFirst({
    where: { OR: [{ id }, { ref: id }] },
    select: { id: true, ref: true, pdfData: true },
  });
  if (!receipt) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }
  let buf: Buffer | null = receipt.pdfData ? Buffer.from(receipt.pdfData) : null;
  if (!buf) {
    try {
      buf = await renderReceiptPdfBuffer(receipt.id);
      await prisma.receipt.update({
        where: { id: receipt.id },
        data: { pdfData: new Uint8Array(buf), pdfStatus: "GENERATED" },
      });
    } catch (e) {
      logServerError(`receipt ${receipt.ref}: PDF render failed`, e);
      return NextResponse.json({ error: "Couldn't build the PDF right now. Please try again." }, { status: 500 });
    }
  }
  return new NextResponse(new Uint8Array(buf!), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Belgrove-Receipt-${receipt.ref}.pdf"`,
      "Cache-Control": "private, no-store, must-revalidate",
    },
  });
}
