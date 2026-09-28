// Best-effort fixed-window rate limiter for public surfaces (booking form,
// client receipt pages). In-memory per process — sufficient as abuse friction,
// not a distributed guarantee. Authenticated admin routes are not limited.
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function sweep(now: number): void {
  if (buckets.size < 1000) return;
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): { ok: boolean; remaining: number; retryAfterMs: number } {
  sweep(now);
  const cur = buckets.get(key);
  if (!cur || cur.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }
  if (cur.count >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: cur.resetAt - now };
  }
  cur.count += 1;
  return { ok: true, remaining: limit - cur.count, retryAfterMs: 0 };
}

export function rateLimitResponse(retryAfterMs: number): Response {
  return new Response(JSON.stringify({ error: "Too many requests. Please try again shortly." }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))),
    },
  });
}
