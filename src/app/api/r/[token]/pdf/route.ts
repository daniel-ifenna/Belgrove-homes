import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { prisma } from "@/lib/prisma";
import { receiptPdfAbsolute } from "@/lib/receipt-storage";
import { isTokenUsable } from "@/lib/receipt-access";

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
    select: { ref: true, pdfPath: true, accessToken: true, accessTokenRevokedAt: true },
  });
  if (!receipt || !isTokenUsable(receipt) || !receipt.pdfPath) {
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
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
