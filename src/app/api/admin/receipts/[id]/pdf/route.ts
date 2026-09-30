import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { receiptPdfAbsolute } from "@/lib/receipt-storage";
import { writeReceiptPdf } from "@/lib/receipt-storage";
import { renderReceiptPdfBuffer } from "@/lib/receipt-render";
import { logServerError } from "@/lib/paymentConfirmation";

// Admin-only receipt PDF download (accepts receipt id or ref). Client PDFs
// live in private storage (storage/receipts/) and are never served statically.
// The file is a best-effort cache (ephemeral on serverless) — on a miss the
// PDF is regenerated from the receipt snapshot so downloads keep working.
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const receipt = await prisma.receipt.findFirst({
    where: { OR: [{ id }, { ref: id }] },
    select: { id: true, ref: true, pdfPath: true },
  });
  if (!receipt?.pdfPath) {
    return NextResponse.json({ error: "PDF not yet generated" }, { status: 404 });
  }
  const cached = (() => {
    try {
      const filePath = receiptPdfAbsolute(receipt.pdfPath);
      if (fs.existsSync(filePath)) return fs.readFileSync(filePath);
    } catch {
      // Fall through to regeneration.
    }
    return null;
  })();
  let buf: Buffer | null = cached;
  if (!buf) {
    try {
      buf = await renderReceiptPdfBuffer(receipt.id);
      // Refresh the ephemeral cache; a write failure must not fail the download.
      if (receipt.pdfPath) {
        await writeReceiptPdf(receipt.pdfPath, buf).catch((e) =>
          logServerError(`receipt ${receipt.ref}: PDF cache refresh failed`, e)
        );
      }
    } catch (e) {
      logServerError(`receipt ${receipt.ref}: PDF regen failed`, e);
      return NextResponse.json({ error: "PDF not yet generated" }, { status: 404 });
    }
  }
  return new NextResponse(new Uint8Array(buf!), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Belgrove-Receipt-${receipt.ref}.pdf"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
