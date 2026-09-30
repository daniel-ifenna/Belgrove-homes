import nodemailer from "nodemailer";
import { getEmailProvider, sendViaResend } from "./resendProvider";

export type EmailResult = {
  sent: boolean;
  error: string | null;
  // Permanent failures (e.g. Resend 4xx validation) must fail the outbox row
  // immediately instead of riding the retry/backoff path forever.
  permanent?: boolean;
};

let transporter: nodemailer.Transporter | null = null;
let transporterFingerprint: string | null = null;

function getTransporterFingerprint(): string {
  // Fingerprint the config that determines transport if env changes between
  // calls (e.g. ZOHO disabled mid-run, MailHog creds swapped) we must rebuild.
  return [
    process.env.ZOHO_APP_PASSWORD ?? "",
    process.env.SMTP_HOST ?? "",
    process.env.SMTP_PORT ?? "",
    process.env.SMTP_USER ?? "",
  ].join("|");
}

function getTransporter() {
  const fp = getTransporterFingerprint();
  if (!transporter || transporterFingerprint !== fp) {
    transporterFingerprint = fp;
    // Zoho (production) uses ZOHO_APP_PASSWORD + info@belgrovehomes.com
    // Falls back to generic SMTP_HOST for local dev (MailHog)
    // Short timeouts are load-bearing on serverless: nodemailer's defaults
    // wait minutes on a stalled connection, but the function is killed at
    // maxDuration (30s) — the outbox row would wedge in SENDING with an empty
    // lastError. Failing fast turns a stall into a normal deferral (PENDING
    // + lastError + backoff) that the next drain retries.
    const timeouts = {
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    };
    if (process.env.ZOHO_APP_PASSWORD) {
      transporter = nodemailer.createTransport({
        host: "smtp.zoho.com",
        port: 587,
        secure: false,
        auth: {
          user: "info@belgrovehomes.com",
          pass: process.env.ZOHO_APP_PASSWORD,
        },
        ...timeouts,
      });
    } else {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: false,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        ...timeouts,
      });
    }
  }
  return transporter;
}

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
  // Outbox row id, forwarded as the provider's idempotency key so a retried
  // row can never double-send. Optional so direct callers keep working.
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
  // Provider switch (default SMTP — nothing changes until EMAIL_PROVIDER is
  // flipped). Dev-policy checks above stay common to both paths.
  if (getEmailProvider() === "resend") {
    return sendViaResend({
      to: resolvedTo,
      subject: resolvedSubject,
      html,
      attachments,
      idempotencyKey,
    });
  }
  try {
    await getTransporter().sendMail({
      from,
      to: resolvedTo,
      subject: resolvedSubject,
      html,
      ...(attachments ? { attachments } : {}),
    });
    return { sent: true, error: null };
  } catch (err) {
    console.error("Email send failed:", err);
    return { sent: false, error: err instanceof Error ? err.message : "Unknown email error" };
  }
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
