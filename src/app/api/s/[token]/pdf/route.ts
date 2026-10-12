import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit";
import { logServerError } from "@/lib/paymentConfirmation";

export const dynamic = "force-dynamic";

// Client statement PDF download. No login — the unguessable token is the
// authorization; revoked/unknown tokens get an identical 404. Rate-limited.
// Serves the stored immutable bytes (the statement as issued).
export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const rl = checkRateLimit(`statement-pdf:${clientIp(request.headers)}`, 30, 15 * 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterMs);
  const { token } = await ctx.params;
  if (!token) {
    return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  }
  try {
    const stmt = await prisma.statement.findUnique({
      where: { token },
      select: { number: true, pdfData: true, tokenRevokedAt: true },
    });
    if (!stmt || stmt.tokenRevokedAt) {
      return NextResponse.json({ error: "Statement not found" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(Buffer.from(stmt.pdfData)), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Belgrove-${stmt.number}.pdf"`,
        "Cache-Control": "private, no-store, must-revalidate",
      },
    });
  } catch (e) {
    logServerError(`statement pdf`, e);
    return NextResponse.json({ error: "Couldn't load the statement right now. Please try again." }, { status: 500 });
  }
}
