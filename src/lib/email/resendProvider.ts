import type { EmailResult } from "./sendEmail";

// HTTP email provider (Resend) — plain fetch, no new dependencies. Used when
// EMAIL_PROVIDER="resend"; the SMTP sender stays the default and the fallback.
// The API key is only ever sent as the Authorization header, never logged.

export type EmailProvider = "resend" | "smtp";

export function getEmailProvider(): EmailProvider {
  return process.env.EMAIL_PROVIDER === "resend" ? "resend" : "smtp";
}

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

export const RESEND_TIMEOUT_MS = 10_000;

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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? RESEND_TIMEOUT_MS);
  try {
    const res = await (opts.fetchImpl ?? fetch)("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
      },
      body: JSON.stringify({
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
      }),
      signal: controller.signal,
    });
    if (res.ok) {
      return { sent: true, error: null };
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
    return { sent: false, error: aborted ? "Resend request timed out" : e instanceof Error ? e.message : "Unknown Resend error" };
  } finally {
    clearTimeout(timeout);
  }
}
