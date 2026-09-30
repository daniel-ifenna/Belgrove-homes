import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { processOutbox } from "@/lib/email/outbox";
import { logServerError } from "@/lib/paymentConfirmation";

// Per-row "Retry now" for stuck outbox mail (EMAIL_STUCK inbox items).
// Bearer-less: admin session auth, same as every other /api/admin route.
// Runs the single row through the standard path (atomic claim + in-process
// retries) and returns its new status for the UI.
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const existing = await prisma.emailOutbox.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Outbox row not found" }, { status: 404 });
  try {
    await processOutbox({ ids: [id] });
  } catch (e) {
    logServerError("outbox retry failed", e);
    return NextResponse.json({ error: "Couldn't retry right now. Please try again." }, { status: 500 });
  }
  const row = await prisma.emailOutbox.findUnique({
    where: { id },
    select: { id: true, status: true, attempts: true, lastError: true },
  });
  return NextResponse.json({
    id,
    status: row?.status ?? null,
    attempts: row?.attempts ?? null,
    lastError: row?.lastError ?? null,
  });
}
