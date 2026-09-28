import { sendEmail } from "../email/sendEmail";
import { formatDisplayName } from "../formatName";

function systemLayout(title: string, bodyHtml: string): string {
  return `
  <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 560px; margin: 0 auto; color: #2b2620;">
    <div style="background: #3a3226; padding: 24px 32px;">
      <span style="color: #f5ece1; font-size: 20px; letter-spacing: 0.05em;">BELGROVE HOMES</span>
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
}) {
  // Use system email template styling — same as bookingReceivedTemplate etc.
  // Prevent iOS/Android auto-linking of address/phone by disabling format detection and wrapping
  const body = `
      <p>Hi ${formatDisplayName(opts.clientName)},</p>
      <p>Your receipt for <strong>${opts.ref}</strong> is attached as PDF. You can also view or re-download it anytime at:</p>
      <p><a href="${opts.receiptUrl}" style="color:#1E3A2E; font-weight:bold; word-break:break-all;">${opts.receiptUrl}</a></p>
      <p>Scan the QR code on the receipt to verify it instantly. It points to the same link above.</p>
      <p>Thank you. It is a pleasure doing business with you.</p>
      <div style="margin-top:20px; padding:12px 14px; background:#fdfbf7; border:1px solid #efe8dc; font-size:12px; color:#6b6055; line-height:1.5;">
        <span style="color:#6b6055; text-decoration:none;">Belgrove Homes and Properties Limited<br/>
        <span style="color:#6b6055; text-decoration:none;">Ste 25, Lebrex Plaza, 47 Ajose Adeogun St, Utako, Abuja 900108, Federal Capital Territory</span><br/>
        <span style="color:#6b6055; text-decoration:none;">www.belgrovehomes.com &middot; info@belgrovehomes.com &middot; +234 8103760063</span></span>
      </div>
      <style>
        a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
        a[x-apple-data-detectors-type="address"] { color: inherit !important; text-decoration: none !important; }
      </style>
      <meta name="format-detection" content="address=no,telephone=no">`;

  const html = systemLayout(`Your receipt ${opts.ref} is ready`, body);
  return sendEmail({
    to: opts.to,
    subject: `Your Belgrove receipt ${opts.ref}`,
    html,
    attachments: [
      {
        filename: `Belgrove-Receipt-${opts.ref}.pdf`,
        content: opts.pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  } as any);
}
