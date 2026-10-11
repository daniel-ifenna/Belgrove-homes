import { sendViaResend } from "./resendProvider";

export type EmailResult = {
  sent: boolean;
  error: string | null;
  // Permanent failures (e.g. Resend 4xx validation) must fail the caller
  // immediately instead of riding any retry path.
  permanent?: boolean;
  // Proof of sending, populated on success only: Resend's email id for
  // tracing a delivery in the Resend dashboard.
  provider?: "resend";
  providerMessageId?: string | null;
};

// Single email transport: Resend HTTP API only. There is no SMTP path —
// the legacy direct-credential sender was removed (Step 1); Resend's
// dashboard is the delivery log. Every email type in the app goes through
// this wrapper.
export async function sendEmail({
  to,
  subject,
  html,
  attachments,
  idempotencyKey,
}: {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer; contentType: string; cid?: string }[];
  // Idempotency key forwarded as Resend's Idempotency-Key header.
  // Retries of ONE logical send reuse the same key with a byte-identical
  // body (safe replay). Every user-initiated resend generates a fresh key —
  // never reuse a key across different bodies (Resend 409s it).
  idempotencyKey?: string;
}): Promise<EmailResult> {
  const from = process.env.SMTP_FROM;
  if (!from) {
    const msg = "SMTP_FROM is not configured email not sent";
    console.error(msg);
    return { sent: false, error: msg };
  }
  if (!to || (Array.isArray(to) && to.length === 0)) {
    return { sent: false, error: "No recipients" };
  }
  // Dev safety: never email real recipients outside production.
  let resolvedTo: string | string[];
  let resolvedSubject = subject;
  try {
    const policy = applyDevEmailPolicy({ to, subject });
    if (policy.dropped) {
      console.warn(`[email-dev] dropped email to ${JSON.stringify(to)} (not in EMAIL_DEV_ALLOWLIST)`);
      return { sent: false, error: "All recipients dropped by dev allowlist" };
    }
    resolvedTo = policy.to;
    resolvedSubject = policy.subject;
    if (policy.redirectedFrom) {
      console.warn(`[email-dev] redirected email to ${JSON.stringify(to)} → ${policy.to} (subject: ${policy.subject})`);
    }
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : "Email policy error" };
  }
  return sendViaResend({
    to: resolvedTo,
    subject: resolvedSubject,
    html,
    attachments,
    idempotencyKey,
  });
}

// Dev email safety policy (pure, unit-tested). Outside production, mail must
// never reach real recipients: redirect everything to EMAIL_DEV_REDIRECT when
// set, otherwise drop recipients not on EMAIL_DEV_ALLOWLIST. Subjects gain a
// [DEV] prefix so redirected mail is unmistakable.
export function applyDevEmailPolicy({ to, subject }: { to: string | string[]; subject: string }): {
  to: string | string[];
  subject: string;
  redirectedFrom: string[] | null;
  dropped: boolean;
} {
  if (process.env.NODE_ENV === "production") {
    return { to, subject, redirectedFrom: null, dropped: false };
  }
  const devSubject = subject.startsWith("[DEV]") ? subject : `[DEV] ${subject}`;
  const original = (Array.isArray(to) ? to : [to]).map((r) => r.trim()).filter(Boolean);
  const redirect = process.env.EMAIL_DEV_REDIRECT?.trim() || null;
  if (redirect) {
    return { to: redirect, subject: devSubject, redirectedFrom: original, dropped: false };
  }
  const allowlist = (process.env.EMAIL_DEV_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.length === 0) {
    throw new Error(
      "Refusing to send email outside production: set EMAIL_DEV_REDIRECT (or EMAIL_DEV_ALLOWLIST) in dev."
    );
  }
  const kept = original.filter((r) => allowlist.includes(r.toLowerCase()));
  if (kept.length === 0) {
    return { to: original, subject: devSubject, redirectedFrom: null, dropped: true };
  }
  return { to: kept, subject: devSubject, redirectedFrom: null, dropped: false };
}
