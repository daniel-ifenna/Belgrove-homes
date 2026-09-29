import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import { amountToWords } from "./amountToWords";
import { formatNaira } from "../currency";
import { formatDisplayName } from "../formatName";
import { receiptAmountsRows } from "../receipt-amounts";
import { drawLetterhead } from "../documents/brand";

// Server-only: signature asset stored in private path, never as public URL
const SIGNATURE_REL = path.join(process.cwd(), "src/lib/receipts/belgrove-cashier-signature.png");
const FONT_REGULAR_REL = path.join(process.cwd(), "src/lib/receipts/fonts/NotoSans-Regular.ttf");
const FONT_BOLD_REL = path.join(process.cwd(), "src/lib/receipts/fonts/NotoSans-Bold.ttf");

type PaymentRow = { date: string; method: string; amount: number };

export type ReceiptData = {
  ref: string;
  issuedDate: string;
  clientName: string;
  clientAddress: string; // ignored for Issued To — keep for compat but not rendered as property
  clientPhone: string;
  clientEmail: string;
  estateName: string;
  unitType: string;
  plotCode: string;
  amountPaid: number;
  soldPrice: number;
  discount?: number;
  payments: PaymentRow[];
  receiptUrl: string;
  qrDataUrl?: string;
  // Extended for new property table + payment details (spec 13/14)
  unitPrice?: number;
  plotQuantity?: number;
  paymentPlanName?: string;
  interestAmount?: number;
  totalPayable?: number;
  previouslyPaid?: number;
  totalPaidAfter?: number;
  outstandingBalance?: number;
  transactionRef?: string;
  installmentLabel?: string;
};

function loadSignatureBase64(): string | null {
  try {
    if (!fs.existsSync(SIGNATURE_REL)) return null;
    const buf = fs.readFileSync(SIGNATURE_REL);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function embedNotoSans(doc: jsPDF) {
  try {
    if (fs.existsSync(FONT_REGULAR_REL)) {
      const reg = fs.readFileSync(FONT_REGULAR_REL).toString("base64");
      (doc as any).addFileToVFS("NotoSans-Regular.ttf", reg);
      (doc as any).addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
    }
    if (fs.existsSync(FONT_BOLD_REL)) {
      const bold = fs.readFileSync(FONT_BOLD_REL).toString("base64");
      (doc as any).addFileToVFS("NotoSans-Bold.ttf", bold);
      (doc as any).addFont("NotoSans-Bold.ttf", "NotoSans", "bold");
    }
  } catch (e) {
    // fallback to helvetica if embedding fails — but Naira may break
    console.error("Failed to embed NotoSans", e);
  }
}

function drawPersonIcon(doc: jsPDF, x: number, y: number, size: number) {
  // PDF-compatible vector person icon — no icon font, no unicode glyph
  // Head circle + shoulders arc, filled with brand color
  const headR = size * 0.32;
  const headY = y - size * 0.28;
  const bodyW = size * 0.9;
  const bodyH = size * 0.5;
  const bodyY = y + size * 0.22;
  doc.setFillColor(22, 40, 31);
  // head
  doc.circle(x, headY, headR, "F");
  // shoulders — use ellipse for rounded shoulders
  (doc as any).ellipse(x, bodyY, bodyW / 2, bodyH / 2, "F");
  // small white cut to separate head/body visually (optional)
  doc.setFillColor(255, 255, 255);
  doc.circle(x, headY + headR * 0.6, headR * 0.35, "F");
  doc.setFillColor(22, 40, 31);
}

export function generateReceiptPdf(data: ReceiptData): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  embedNotoSans(doc);
  const useNoto = fs.existsSync(FONT_REGULAR_REL);
  const fontName = useNoto ? "NotoSans" : "helvetica";

  const W = doc.internal.pageSize.getWidth();
  const margin = 12;
  const rightX = W - margin;
  // Branded letterhead (shared module): logo + company block + gold rule.
  // Returns the y where body content starts — never overlapping the header.
  let y = drawLetterhead(doc, fontName, { margin, top: 14 });

  // Title & receipt number — no hashtag, no overlap with golden border
  doc.setFont(fontName, "bold");
  doc.setFontSize(22);
  doc.setTextColor(22, 40, 31);
  doc.text("RECEIPT", margin, y);
  doc.setFontSize(8);
  doc.setFont(fontName, "normal");
  doc.setTextColor(107, 102, 86);
  doc.text(`RECEIPT: ${data.ref}`, rightX, y - 6, { align: "right" });
  doc.text(`ISSUED DATE: ${data.issuedDate}`, rightX, y - 1, { align: "right" });
  y += 10;

  // Issued to block + Amount panel
  const leftW = 110;
  const panelW = W - margin * 2 - leftW - 6;
  const panelX = margin + leftW + 6;
  const blockTop = y;

  // Issued to — ONLY customer information (no property description, no icon)
  doc.setFont(fontName, "bold");
  doc.setFontSize(7);
  doc.setTextColor(107, 102, 86);
  doc.text("ISSUED TO", margin, y);
  y += 6;
  const displayName = formatDisplayName(data.clientName);
  doc.setFont(fontName, "bold");
  doc.setFontSize(10);
  doc.setTextColor(22, 40, 31);
  doc.text(displayName, margin, y);
  y += 6;
  doc.setFont(fontName, "normal");
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  // Only phone/email under Issued To — do NOT render property description here
  if (data.clientPhone) {
    doc.text(data.clientPhone, margin, y);
    y += 3.5;
  }
  if (data.clientEmail) {
    doc.text(data.clientEmail, margin, y);
    y += 3.5;
  }
  // Provide small breathing room
  y += 2;

  // Amount panel (right) — fill with --accent-gold #C79A46
  const amountPanelTop = blockTop - 2;
  const amountPanelH = 36;
  doc.setFillColor(199, 154, 70);
  (doc as any).roundedRect(panelX, amountPanelTop, panelW, amountPanelH, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont(fontName, "bold");
  doc.setFontSize(7);
  doc.text("AMOUNT", panelX + 4, amountPanelTop + 7);
  doc.setFontSize(16);
  doc.text(formatNaira(data.amountPaid), panelX + 4, amountPanelTop + 16);
  doc.setFont(fontName, "normal");
  doc.setFontSize(7);
  doc.text(`SOLD PRICE: ${formatNaira(data.soldPrice)}`, panelX + 4, amountPanelTop + 22);
  if (typeof data.discount === "number" && data.discount > 0) {
    doc.text(`DISCOUNTS: ${formatNaira(data.discount)}`, panelX + 4, amountPanelTop + 27);
  }

  y = Math.max(y + 4, amountPanelTop + amountPanelH + 8);

  // Property table — MUST be Property | Unit Price | Plot Qty | Amount Due (spec 13)
  // Extend ReceiptData to carry unitPrice/plotQuantity if available (fallback to data)
  const unitPriceVal = (data as any).unitPrice ?? data.soldPrice;
  const plotQtyVal = (data as any).plotQuantity ?? 1;
  const amountDueVal = unitPriceVal * plotQtyVal;
  const propTableX = margin;
  const propColW = [(W - margin * 2) * 0.42, (W - margin * 2) * 0.22, (W - margin * 2) * 0.14, (W - margin * 2) * 0.22];
  doc.setFillColor(22, 40, 31);
  doc.rect(propTableX, y, W - margin * 2, 7, "F");
  doc.setTextColor(212, 179, 104);
  doc.setFont(fontName, "bold");
  doc.setFontSize(7);
  const propHeaders = ["Property", "Unit Price", "Plot Qty", "Amount Due"];
  let pcx = propTableX + 2;
  for (let i = 0; i < propHeaders.length; i++) {
    const align = i >= 1 ? "right" : "left";
    const tx = i === 0 ? pcx : i === 3 ? propTableX + W - margin * 2 - 2 : propTableX + propColW.slice(0, i).reduce((a, b) => a + b, 0) + 2;
    // For Unit Price, Plot Qty, Amount Due we right-align
    const isRight = i > 0;
    doc.text(propHeaders[i], isRight ? (i === 3 ? propTableX + W - margin * 2 - 2 : propTableX + propColW.slice(0, i).reduce((a, b) => a + b, 0) + propColW[i] - 2) : pcx, y + 4.5, { align: isRight ? "right" : "left" });
  }
  y += 7;
  doc.setFillColor(247, 242, 231);
  doc.rect(propTableX, y, W - margin * 2, 7, "F");
  doc.setDrawColor(228, 220, 199);
  doc.rect(propTableX, y, W - margin * 2, 7, "S");
  doc.setTextColor(22, 40, 31);
  doc.setFont(fontName, "normal");
  doc.setFontSize(7);
  // Draw vertical lines
  let pvx = propTableX;
  for (let i = 0; i < propColW.length - 1; i++) {
    pvx += propColW[i];
    doc.line(pvx, y, pvx, y + 7);
  }
  doc.text(data.estateName.substring(0, 32), propTableX + 2, y + 4.5);
  doc.text(formatNaira(unitPriceVal), propTableX + propColW[0] + propColW[1] - 2, y + 4.5, { align: "right" });
  doc.text(String(plotQtyVal), propTableX + propColW[0] + propColW[1] + propColW[2] - 2, y + 4.5, { align: "right" });
  doc.text(formatNaira(amountDueVal), propTableX + W - margin * 2 - 2, y + 4.5, { align: "right" });
  y += 12;

  // Payment Details section (spec 14) — show plan, interest, totals if available via extended data
  const ext: any = data as any;
  if (ext.paymentPlanName || ext.interestAmount !== undefined || ext.totalPayable !== undefined) {
    doc.setFont(fontName, "bold");
    doc.setFontSize(7);
    doc.setTextColor(22, 40, 31);
    doc.text("PAYMENT DETAILS", margin, y);
    y += 4;
    doc.setFont(fontName, "normal");
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    const details: [string, string][] = [];
    // Same amounts layout and wording as the admin receipt page and the
    // client receipt (This payment → Installment → Total price →
    // Paid to date → Balance remaining, Discount only when > 0).
    for (const row of receiptAmountsRows({
      thisPayment: data.amountPaid,
      installmentLabel: ext.installmentLabel ?? null,
      totalPrice: ext.totalPayable ?? data.soldPrice,
      paidToDate: ext.totalPaidAfter ?? data.amountPaid,
      balanceRemaining: ext.outstandingBalance ?? data.soldPrice - data.amountPaid,
      discount: data.discount ?? 0,
    })) {
      details.push([`${row.label}:`, typeof row.value === "number" ? formatNaira(row.value) : row.value]);
    }
    if (ext.paymentPlanName) details.push(["Payment Plan:", ext.paymentPlanName]);
    if (ext.interestAmount !== undefined) details.push(["Interest:", formatNaira(ext.interestAmount)]);
    if (ext.previouslyPaid !== undefined) details.push(["Previously Paid:", formatNaira(ext.previouslyPaid)]);
    for (const [label, val] of details) {
      doc.setFont(fontName, "bold");
      doc.text(label, margin, y);
      doc.setFont(fontName, "normal");
      doc.text(val, margin + 38, y);
      y += 3.5;
    }
    y += 2;
  }

  // Payment history table (for audit, single row for this receipt)
  const colW = [(W - margin * 2) * 0.08, (W - margin * 2) * 0.32, (W - margin * 2) * 0.32, (W - margin * 2) * 0.28];
  const tableX = margin;
  doc.setFillColor(22, 40, 31);
  doc.rect(tableX, y, W - margin * 2, 7, "F");
  doc.setTextColor(212, 179, 104);
  doc.setFont(fontName, "bold");
  doc.setFontSize(7);
  const headers = ["#", "Payment Date", "Payment Method", "Amount (\u20A6)"];
  let cx = tableX + 2;
  for (let i = 0; i < headers.length; i++) {
    const align = i === 3 ? "right" : "left";
    const tx = i === 3 ? tableX + W - margin * 2 - 2 : cx;
    doc.text(headers[i], tx, y + 4.5, { align: align as any });
    cx += colW[i];
  }
  y += 7;
  doc.setTextColor(22, 40, 31);
  doc.setFont(fontName, "normal");
  doc.setFontSize(7);
  for (let i = 0; i < data.payments.length; i++) {
    const r = data.payments[i];
    const rowY = y + 4;
    const isStripe = i % 2 === 1;
    if (isStripe) {
      doc.setFillColor(247, 242, 231);
      doc.rect(tableX, y, W - margin * 2, 7, "F");
    }
    doc.setDrawColor(228, 220, 199);
    doc.rect(tableX, y, W - margin * 2, 7, "S");
    let vx = tableX;
    for (let c = 0; c < colW.length - 1; c++) {
      vx += colW[c];
      doc.line(vx, y, vx, y + 7);
    }
    doc.text(String(i + 1), tableX + 2, rowY);
    doc.text(r.date, tableX + colW[0] + 2, rowY);
    doc.text(r.method, tableX + colW[0] + colW[1] + 2, rowY);
    doc.text(formatNaira(r.amount), tableX + W - margin * 2 - 2, rowY, { align: "right" });
    y += 7;
  }
  doc.setFillColor(22, 40, 31);
  doc.rect(tableX, y, W - margin * 2, 7, "F");
  doc.setTextColor(212, 179, 104);
  doc.setFont(fontName, "bold");
  doc.text("Total Paid (this receipt)", tableX + 2, y + 4.5);
  doc.text(formatNaira(data.amountPaid), tableX + W - margin * 2 - 2, y + 4.5, { align: "right" });
  y += 10;

  // Amount in words
  doc.setTextColor(80, 80, 80);
  doc.setFont(fontName, "normal");
  doc.setFontSize(7);
  doc.text("Amount in words:", margin, y);
  y += 4;
  doc.setFont(fontName, "bold");
  doc.setTextColor(22, 40, 31);
  doc.setFontSize(8);
  const words = amountToWords(data.amountPaid);
  const wordLines = doc.splitTextToSize(words, W - margin * 2);
  doc.text(wordLines, margin, y);
  y += wordLines.length * 4 + 6;

  // Signature block — electronic receipt: ONLY authorized, customer acknowledgement removed per spec 11
  const sigTop = y;
  const sigCenterX = W / 2 - 30;

  doc.setFont(fontName, "bold");
  doc.setFontSize(7);
  doc.setTextColor(22, 40, 31);
  doc.text("AUTHORIZED BY BELGROVE", sigCenterX, sigTop + 4);
  const sigB64 = loadSignatureBase64();
  if (sigB64) {
    try {
      doc.addImage(sigB64, "PNG", sigCenterX + 2, sigTop + 6, 28, 14);
    } catch (e) {
      console.error("Receipt PDF: signature image embed failed, continuing without it", e);
    }
  }
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.line(sigCenterX, sigTop + 24, sigCenterX + 60, sigTop + 24);
  doc.setFont(fontName, "normal");
  doc.setFontSize(6);
  doc.setTextColor(107, 102, 86);
  doc.text("Authorized Signature", sigCenterX, sigTop + 28);
  doc.text(`Date: ${data.issuedDate}`, sigCenterX, sigTop + 32);

  // Watermark/stamp REMOVED — previously drew BELGROVE HOMES OFFICIAL STAMP circle
  // Intentionally left empty to satisfy P5-17 without leaving placeholder

  y = sigTop + 38;

  // Footer
  doc.setFont(fontName, "bold");
  doc.setFontSize(9);
  doc.setTextColor(22, 40, 31);
  doc.text("THANK YOU!", margin, y);
  y += 4;
  doc.setFont(fontName, "normal");
  doc.setFontSize(7);
  doc.setTextColor(107, 102, 86);
  doc.text("PLEASURE DOING BUSINESS WITH YOU: certainty, not just a deed.", margin, y);
  y += 6;
  doc.setFontSize(6);
  const disclaimer =
    "This receipt acknowledges payment as received and reconciled by Belgrove Homes accounts. Property allocation is subject to completion of the agreed payment plan and verification of funds. Keep this receipt safely; present it for allocation and documentation.";
  const discLines = doc.splitTextToSize(disclaimer, W - margin * 2 - 30);
  doc.text(discLines, margin, y);
  if (data.qrDataUrl) {
    try {
      const qrSize = 22;
      const qrX = W - margin - qrSize;
      const qrY = y - 6;
      doc.addImage(data.qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
      doc.setFontSize(5);
      doc.setTextColor(107, 102, 86);
      doc.text("Scan to verify", qrX + qrSize / 2, qrY + qrSize + 3, { align: "center" });
    } catch (e) {
      console.error("Receipt PDF: QR embed failed, continuing without it", e);
    }
  }

  const out = doc.output("arraybuffer");
  return Buffer.from(out);
}
