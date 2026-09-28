import QRCode from "qrcode";

export async function generateQrDataUrl(text: string): Promise<string> {
  // Encode the receipt's public URL; scanning takes client to hosted receipt page.
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220,
    color: { dark: "#16281F", light: "#FFFFFF" },
  });
}
