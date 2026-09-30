import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { prisma } from "@/lib/prisma";
import { receiptPdfAbsolute, writeReceiptPdf } from "@/lib/receipt-storage";
import { renderReceiptPdfBuffer } from "@/lib/receipt-render";
import { isTokenUsable } from "@/lib/receipt-access";
import { logServerError } from "@/lib/paymentConfirmation";

// Client receipt PDF download. No login — the unguessable access token in the
// URL is the authorization. Revoked or unknown tokens get 404 (no existence
// oracle for revoked vs unknown).
export async function GET(_request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!token) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }
  const receipt = await prisma.receipt.findUnique({
    where: { accessToken: token },
    select: { id: true, ref: true, pdfPath: true, accessToken: true, accessTokenRevokedAt: true },
  });
  if (!receipt || !isTokenUsable(receipt) || !receipt.pdfPath) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }
  // Ephemeral cache (serverless /tmp): regenerate from the snapshot on miss.
  let buf: Buffer | null = null;
  try {
    const filePath = receiptPdfAbsolute(receipt.pdfPath);
    if (fs.existsSync(filePath)) buf = fs.readFileSync(filePath);
  } catch {
    buf = null;
  }
  if (!buf) {
    try {
      buf = await renderReceiptPdfBuffer(receipt.id);
      await writeReceiptPdf(receipt.pdfPath, buf).catch((e) =>
        logServerError(`receipt ${receipt.ref}: PDF cache refresh failed`, e)
      );
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
