import type { jsPDF } from "jspdf";

// Central document branding: every generated PDF (receipts, exports) draws
// its header through here so the logo treatment is identical everywhere.
//
// The logo is embedded as a base64 data URL (1KB source) rather than read
// from disk at request time: serverless functions do not reliably ship
// public/ on their filesystem, so an fs read is exactly how a logo
// "works in dev, disappears in prod". Nothing here can throw for a missing
// file — brandLogo() returns null and callers fall back to wordmark-only.

export const BRAND_LOGO_NATURAL_W = 87;
export const BRAND_LOGO_NATURAL_H = 70;

const BRAND_LOGO_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFcAAABGCAYAAAC5QghSAAAACXBIWXMAAAsSAAALEgHS3X78AAADrklEQVR4nO2cy3HbMBRFjzXZ0x1EHdgFcMboIFlp7Q6iDuIS5A6cLVd2BYFnVEDcgVNBzAqchQCNPgAJiADxxNFZeUiaur6+fHwgCF19fn6SirapH4B74Guyk8bxAjxUi/WfQp+/x1Uqc42xP5OcbBgtMK8W64/SQmYJz7VMeK4hVGyunuIkMbdt6ls2f5QUrksLgHTJ/Z7oPJMilbkq0XkmxWBz26a+Bu4SaJkcKZKrEpxjkqQw91JvPVySm5FB5rZNPafcaEw8Q5N7KQkdDDVXpRAxVYaa+y2JiolysrltU19KQg9DkqtSiZgqF3MzcpK5pgW7SSslKSIelp+aXJVSRGJaQJcWAaebK/lmtpIwCwHTS24LrEqLsESbK3DWYRcxqYXTkiu1JIhKLcCXE35HpRaRCGdqTWczH1HHe7VYv0Pk1LqZdfiXSdQQnNPpbVOvgB8F9LwC32PLgsogJAVHqTXvUZQwFjbTXqtYcyXW26Naa66w0u9RTCK5rlq7REBHE2yuacGkzTpITS2AjkmuyqViAGJTCzyfs7mSUwuRyZU26yA5tW/VYv0eZG7b1CqzmFjEpxbCb2jSWjDJqQV4hnBzVT4d0UhPbVst1hrCzZU06yA9tdr+kPLN8jGQnlowJQHCzf2VSUgs0lMLJyR3SXmDH6vF+mF3g8DUvtnHjRD4PNek5R4hCzl2EJtaOL+au0VgamGn3sIZm4u81G5bMMtZmis0tfpww1mai7zUwkFJgDM0V2hqwZFcb7dgHo4vGXfm1PIMPHneQVDIS+1eC2Zxmmuegv3OLKiLO+C+bWrlMPi2hKAetGujryxIeLniBnl9tY+jegsOc01Nk/KgxrVAWo0tooejFsziSq7KKmV6aN8Ol7mSHoy7LjcRy/13cJYEkJ3c1vN1KlJKlkX7duyZK2xFpC4tIABnC2Y5TK7okmD++ZLQXTsPzVXZZMSjHdvmI2vow1tvQa65f7suNyF4WzDL1lwzKpMyrPQlQtLoTPcdsJtclU1GPNqzXVIb1lkSYN9cSTczXVpAALrvgBmIG/K+dqzIUWMK6aCzBbPY5KqsUuLQpQUEoEMOsuZKKgldtUxKze2ttyAvub4hr0VC6eptwSyzy5A3Gh164IwzKQmChr5BJQE25qp8OqLRHfvmI2noQ4ceKGn2N6i9KUyUxhkRMc9Mpw5zE2nHkeIlyqtZtVg/AY95tATzcvgGowdFOYNDNW7ZLqwusLrb8hH7Be4FFsBEawT4D1+NFElHOdv0AAAAAElFTkSuQmCC";

export function brandLogo(): string {
  return BRAND_LOGO_DATA_URL;
}

/** Proportional fit inside a max box (mm) — never stretched, never cropped. */
export function logoFit(maxWmm: number, maxHmm: number): { w: number; h: number } {
  const s = Math.min(maxWmm / BRAND_LOGO_NATURAL_W, maxHmm / BRAND_LOGO_NATURAL_H);
  return { w: BRAND_LOGO_NATURAL_W * s, h: BRAND_LOGO_NATURAL_H * s };
}

export const COMPANY = {
  name: "BELGROVE HOMES AND PROPERTIES LIMITED",
  address:
    "Suite 25, Lebrex Plaza, 47 Ajose Adeogun St, Utako, Abuja 900108, Federal Capital Territory",
  website: "www.belgrovehomes.com",
  email: "info@belgrovehomes.com",
  phone: "+234 8103760063",
};

/**
 * Light letterhead header (receipts): logo left with whitespace, company
 * name + address beside it, contact block top-right, gold rule below.
 * Returns the y position where body content may start. All coordinates are
 * derived from the page width — nothing is pushed off-page and nothing
 * overlaps: text columns are width-bounded between the logo and the margin.
 */
export function drawLetterhead(
  doc: jsPDF,
  fontName: string,
  opts?: { margin?: number; top?: number }
): number {
  const margin = opts?.margin ?? 12;
  const top = opts?.top ?? 14;
  const W = doc.internal.pageSize.getWidth();
  const rightX = W - margin;

  // Logo: fitted into a 16×12mm box — prominent but smaller than the text
  // block, ~140dpi from the 87px source so it never pixelates.
  const { w: logoW, h: logoH } = logoFit(16, 12);
  const gap = 4;
  const textX = margin + logoW + gap;
  try {
    doc.addImage(brandLogo(), "PNG", margin, top - 1, logoW, logoH);
  } catch {
    // Wordmark-only fallback: a missing/undecodable image must never break
    // the document.
  }

  doc.setFont(fontName, "bold");
  doc.setFontSize(11);
  doc.setTextColor(22, 40, 31);
  doc.text(COMPANY.name, textX, top);

  doc.setFont(fontName, "normal");
  doc.setFontSize(7);
  doc.setTextColor(107, 102, 86);
  const addrWidth = Math.max(40, rightX - textX - 4);
  const addrLines = doc.splitTextToSize(COMPANY.address, addrWidth);
  doc.text(addrLines, textX, top + 5);
  const leftBottom = top + 5 + (addrLines.length - 1) * 3.5;

  doc.setFontSize(7);
  doc.setTextColor(22, 40, 31);
  doc.text(COMPANY.website, rightX, top, { align: "right" });
  doc.text(COMPANY.email, rightX, top + 4, { align: "right" });
  doc.text(COMPANY.phone, rightX, top + 8, { align: "right" });
  const rightBottom = top + 8;

  const y = Math.max(leftBottom, rightBottom, top - 1 + logoH) + 6;
  doc.setDrawColor(212, 179, 104);
  doc.setLineWidth(0.4);
  doc.line(margin, y, W - margin, y);
  return y + 12;
}

/**
 * Dark report banner (exports): full-bleed brand bar with the logo seated
 * top-right inside the margins, title block left. Fixed 28mm height so body
 * content always starts at the same place regardless of page size.
 */
export function drawReportBanner(
  doc: jsPDF,
  opts: { title: string; subtitle: string; meta: string; margin?: number }
): number {
  const margin = opts?.margin ?? 14;
  const pageW = doc.internal.pageSize.getWidth();
  const bannerH = 28;

  doc.setFillColor(13, 51, 40);
  doc.rect(0, 0, pageW, bannerH, "F");

  // Logo top-right with whitespace on all sides; ~130dpi, never stretched.
  const { w: logoW, h: logoH } = logoFit(18, 14);
  const logoX = pageW - margin - logoW;
  const logoY = (bannerH - logoH) / 2;
  try {
    doc.addImage(brandLogo(), "PNG", logoX, logoY, logoW, logoH);
  } catch {
    // Banner text carries the brand alone if the image can't decode.
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(200, 160, 74);
  doc.text(opts.title, margin, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(opts.subtitle, margin, 17);
  doc.setFontSize(6.5);
  doc.text(opts.meta, margin, 23);

  doc.setFillColor(200, 160, 74);
  doc.rect(0, bannerH, pageW, 0.6, "F");
  return bannerH + 8;
}
