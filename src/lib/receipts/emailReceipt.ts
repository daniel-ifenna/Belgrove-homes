import { sendEmail } from "../email/sendEmail";
import { formatDisplayName } from "../formatName";
import { brandLogo } from "../documents/brand";

const LOGO_CID = "belgrove-logo@belgrovehomes";

// Embedded (CID) logo: travels inside the email so it renders even when the
// client blocks remote images. Falls back to wordmark-only if undecodable.
function logoAttachment(): { filename: string; content: Buffer; contentType: string; cid: string } | null {
  try {
    const b64 = brandLogo().split(",", 2)[1];
    if (!b64) return null;
    return { filename: "belgrove-icon.png", content: Buffer.from(b64, "base64"), contentType: "image/png", cid: LOGO_CID };
  } catch {
    return null;
  }
}

function logoImg(): string {
  return `<img src="cid:${LOGO_CID}" alt="Belgrove Homes" width="34" height="27" style="display: inline-block; vertical-align: middle; border: 0; margin-right: 10px;" />`;
}

function systemLayout(title: string, bodyHtml: string, logoHtml: string): string {
  return `
  <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 560px; margin: 0 auto; color: #2b2620; overflow-wrap: anywhere;">
    <div style="background: #3a3226; padding: 24px 32px;">
      ${logoHtml}
      <span style="color: #f5ece1; font-size: 20px; letter-spacing: 0.05em; vertical-align: middle;">BELGROVE HOMES</span>
    </div>
    <div style="padding: 32px; background: #fdfbf7;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">${title}</h1>
      ${bodyHtml}
    </div>
    <div style="padding: 16px 32px; background: #efe8dc; font-size: 12px; color: #6b6055;">
      Belgrove Homes &middot; This is an automated message regarding your payment. Your receipt is attached and available online.
    </div>
  </div>`;
}

export async function sendReceiptEmail(opts: {
  to: string;
  clientName: string;
  ref: string;
  receiptUrl: string;
  pdfBuffer: Buffer;
  idempotencyKey?: string;
}) {
  // Use system email template styling — same as bookingReceivedTemplate etc.
  // Prevent mail clients (iOS data detectors, Gmail, Outlook) from auto-linking
  // the street address: &zwnj; breaks their detection patterns while rendering
  // invisibly. The meta/style guards below only work in Apple Mail, so this is
  // what carries Gmail/Outlook.
  const body = `
      <p>Hi ${formatDisplayName(opts.clientName)},</p>
      <p>Your receipt for <strong>${opts.ref}</strong> is attached as PDF. You can also view or re-download it anytime at:</p>
      <p style="overflow-wrap:anywhere;"><a href="${opts.receiptUrl}" style="color:#1E3A2E; font-weight:bold; overflow-wrap:anywhere; word-break:normal;">${opts.receiptUrl}</a></p>
      <p>Scan the QR code on the receipt to verify it instantly. It points to the same link above.</p>
      <p>Thank you. It is a pleasure doing business with you.</p>
      <div style="margin-top:20px; padding:12px 14px; background:#fdfbf7; border:1px solid #efe8dc; font-size:12px; color:#6b6055; line-height:1.5;">
        <span style="color:#6b6055; text-decoration:none;">Belgrove Homes and Properties Limited<br/>
        <span style="color:#6b6055; text-decoration:none;">Suite&zwnj; 25, Lebrex Plaza, 47 Ajose&zwnj; Adeogun St, Utako, Abuja&zwnj; 900108, Federal Capital Territory</span><br/>
        <span style="color:#6b6055; text-decoration:none;">www.belgrovehomes.com &middot; info@belgrovehomes.com &middot; +234 8103760063</span></span>
      </div>
      <style>
        a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
        a[x-apple-data-detectors-type="address"] { color: inherit !important; text-decoration: none !important; }
      </style>
      <meta name="format-detection" content="address=no,telephone=no">`;

  const logo = logoAttachment();
  const html = systemLayout(`Your receipt ${opts.ref} is ready`, body, logo ? logoImg() : "");
  return sendEmail({
    to: opts.to,
    subject: `Your Belgrove receipt ${opts.ref}`,
    html,
    idempotencyKey: opts.idempotencyKey,
    attachments: [
      ...(logo ? [logo] : []),
      {
        filename: `Belgrove-Receipt-${opts.ref}.pdf`,
        content: opts.pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  } as any);
}
