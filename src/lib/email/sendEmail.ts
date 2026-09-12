import nodemailer from "nodemailer";

export type EmailResult = { sent: boolean; error: string | null };

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
    if (process.env.ZOHO_APP_PASSWORD) {
      transporter = nodemailer.createTransport({
        host: "smtp.zoho.com",
        port: 587,
        secure: false,
        auth: {
          user: "info@belgrovehomes.com",
          pass: process.env.ZOHO_APP_PASSWORD,
        },
      });
    } else {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: false,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
    }
  }
  return transporter;
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
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
  try {
    await getTransporter().sendMail({
      from,
      to,
      subject,
      html,
    });
    return { sent: true, error: null };
  } catch (err) {
    console.error("Email send failed:", err);
    return { sent: false, error: err instanceof Error ? err.message : "Unknown email error" };
  }
}
