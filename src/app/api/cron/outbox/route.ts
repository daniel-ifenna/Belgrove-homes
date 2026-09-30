import { NextResponse } from "next/server";
import { processOutbox } from "@/lib/email/outbox";

export const dynamic = "force-dynamic";

// Manual retry drain for the email outbox — no scheduler calls this; the
// primary send path is the inline after() send in each route, backed by the
// drain-on-enqueue, the admin-inbox-load drain, and the per-row Retry button.
// Bearer-protected with CRON_SECRET (header or ?secret=). Kept for manual
// recovery: POST (or GET) with the secret and inspect {sent,failed,deferred}.
async function drain(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  const url = new URL(request.url);
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || url.searchParams.get("secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await processOutbox();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  return drain(request);
}

export async function POST(request: Request) {
  return drain(request);
}
