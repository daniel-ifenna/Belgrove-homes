import type { EmailResult } from "./sendEmail";

// HTTP email provider (Resend) — plain fetch, no new dependencies. The ONLY
// transport: sendEmail() always routes here. The API key is only ever sent
// as the Authorization header, never logged.

export type ResendAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
  cid?: string;
};

// Minimal html→text for the text body: strip tags, decode common entities,
// collapse whitespace. No dependency; deliverability fallback, not pretty.
export function htmlToText(html: string): string {
  return html
    .replace(/<(br|p|div|li|tr|h1|h2|h3)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

export const RESEND_TIMEOUT_MS = 30_000;

// Explicit, bounded, and overridable without a redeploy of the logic:
// RESEND_TIMEOUT_MS (ms) clamps to 5s..60s so a stuck provider call can
// neither hang a serverless function past maxDuration nor abort
// prematurely on a slow-but-healthy API. Timeouts stay retryable
// (never `permanent`).
//
// 30s default (was 10s): sends carry ~1MB base64 PDF attachments and run on
// serverless after() workers where CPU can stall; production showed repeated
// 10s timeouts that later succeeded unchanged. The timeout covers the network
// request only — the body (including attachment encoding) is built first.
export function resendTimeoutMs(): number {
  const raw = Number(process.env.RESEND_TIMEOUT_MS ?? RESEND_TIMEOUT_MS);
  if (!Number.isFinite(raw)) return RESEND_TIMEOUT_MS;
  return Math.min(60_000, Math.max(5_000, Math.floor(raw)));
}

export async function sendViaResend(opts: {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: ResendAttachment[];
  idempotencyKey?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, error: "RESEND_API_KEY is not configured" };
  }
  const from = process.env.SMTP_FROM;
  if (!from) {
    return { sent: false, error: "SMTP_FROM is not configured email not sent" };
  }
  const recipients = (Array.isArray(opts.to) ? opts.to : [opts.to]).map((r) => r.trim()).filter(Boolean);
  if (recipients.length === 0) {
    return { sent: false, error: "No recipients" };
  }
  // Build the full request body BEFORE starting the timeout clock, so the
  // timeout covers the network request only (base64 attachment encoding of
  // ~800KB PDFs is CPU work, not network stall).
  const requestBody = JSON.stringify({
    from,
    to: recipients,
    subject: opts.subject,
    html: opts.html,
    text: htmlToText(opts.html),
    ...(opts.attachments?.length
      ? {
          attachments: opts.attachments.map((a) => ({
            filename: a.filename,
            content: a.content.toString("base64"),
            content_type: a.contentType,
            ...(a.cid ? { content_id: a.cid } : {}),
          })),
        }
      : {}),
  });
  // Retries of one logical send MUST reuse the same idempotency key with this
  // exact body (safe replay). A user-initiated resend always mints a fresh key.
  const timeoutMs = opts.timeoutMs ?? resendTimeoutMs();
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await (opts.fetchImpl ?? fetch)("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
      },
      body: requestBody,
      signal: controller.signal,
    });
    if (res.ok) {
      let providerMessageId: string | null = null;
      try {
        const body = (await res.json()) as { id?: unknown };
        if (typeof body?.id === "string") providerMessageId = body.id;
      } catch {
        // Non-JSON 2xx: still sent, just without a traceable id.
      }
      return { sent: true, error: null, provider: "resend", providerMessageId };
    }
    const detail = await res.text().catch(() => "");
    const error = `Resend error ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`;
    // 429 + 5xx are transient (existing retry path handles them). Any other
    // 4xx (bad from-domain, validation) will never succeed on retry — mark
    // permanent so the row fails fast instead of retrying forever.
    if (res.status === 429 || res.status >= 500) {
      return { sent: false, error };
    }
    return { sent: false, error, permanent: true };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    const elapsed = Date.now() - startedAt;
    // Name the elapsed time: "timed out after 10012ms" tells a slow API
    // apart from an instant refusal at a glance in Send History.
    return { sent: false, error: aborted ? `Resend request timed out after ${elapsed}ms` : e instanceof Error ? e.message : "Unknown Resend error" };
  } finally {
    clearTimeout(timeout);
  }
}
