import { NextResponse } from "next/server";
import { processOutbox } from "@/lib/email/outbox";

export const dynamic = "force-dynamic";

// Email outbox processor for cron. Production calls this every minute with
// header or query CRON_SECRET (see README). Delivery also gets a non-blocking
// kick after every enqueue, so the queue drains even without cron.
export async function POST(request: Request) {
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
