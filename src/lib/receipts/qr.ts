import QRCode from "qrcode";

export async function generateQrDataUrl(text: string): Promise<string> {
  // Encode the receipt's public URL; scanning takes client to hosted receipt page.
  // Quiet-zone margin 2 is required for reliable phone-camera scans (margin 1
  // fails on many scanners, especially once printed). Q correction survives
  // print/screenshot degradation; width 256 keeps modules sharp at ~24mm.
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "Q",
    margin: 2,
    width: 256,
    color: { dark: "#16281F", light: "#FFFFFF" },
  });
}

// SVG QR for the statement template (`assets.qrSvg` is embedded as raw markup;
// the template sizes it to 104px). Spec: EC level M, 4-module quiet zone,
// dark ink on white — same palette as receipts.
export async function generateQrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 4,
    width: 104,
    color: { dark: "#16281F", light: "#FFFFFF" },
  });
}
