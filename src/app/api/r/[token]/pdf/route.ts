import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderReceiptPdfBuffer } from "@/lib/receipt-render";
import { isTokenUsable } from "@/lib/receipt-access";
import { logServerError } from "@/lib/paymentConfirmation";

// Client receipt PDF download. No login — the unguessable access token in the
// URL is the authorization. Revoked or unknown tokens get 404 (no existence
// oracle for revoked vs unknown). Reuses stored bytes; renders only when missing.
export async function GET(_request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!token) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }
  const receipt = await prisma.receipt.findUnique({
    where: { accessToken: token },
    select: { id: true, ref: true, pdfData: true, accessToken: true, accessTokenRevokedAt: true },
  });
  if (!receipt || !isTokenUsable(receipt)) {
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
