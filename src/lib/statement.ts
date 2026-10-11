import { jsPDF } from "jspdf";
import { formatNaira } from "./currency";
import { formatDisplayName } from "./formatName";
import { drawLetterhead } from "./documents/brand";
import { embedNotoSans } from "./receipts/pdf-assets";

// Statement of Account: chronological ledger for one transaction — every
// charge, payment, discount, waiver and reversal with a running balance,
// closing balance and generation date. Same branding as receipts. No QR
// graphic: there is no public statement page to point it at; each payment
// row carries its verifiable receipt ref instead.

export type StatementEntry = {
  id: string;
  type: string;
  amount: number;
  direction: string; // DEBIT | CREDIT
  effectiveDate: Date | string;
  createdAt: Date | string;
  method?: string | null;
  bankReference?: string | null;
  paymentReference?: string | null;
  receiptRef?: string | null;
  note?: string | null;
};

export type StatementRow = {
  date: string;
  details: string;
  debit: number | null;
  credit: number | null;
  balance: number;
};

export function describeStatementEntry(e: StatementEntry): string {
  switch (e.type) {
    case "CHARGE_BASE":
      return "Contract price";
    case "CHARGE_INTEREST":
      return "Interest (one-time charge)";
    case "CHARGE_FEE":
      return "Fee";
    case "PAYMENT":
      return `Payment received${e.method ? ` — ${e.method}` : ""}${e.bankReference ? ` (${e.bankReference})` : ""}${e.receiptRef ? ` · ${e.receiptRef}` : ""}`;
    case "DISCOUNT":
      return "Discount";
    case "WAIVER":
      return "Waiver";
    case "ADJUSTMENT":
      return e.note ? `Adjustment — ${e.note}` : "Adjustment";
    case "REVERSAL":
      return "Reversal (voided payment)";
    default:
      return e.note ? `${e.type} — ${e.note}` : e.type;
  }
}

function formatDateDMY(d: Date | string): string {
  const x = new Date(d);
  const dd = String(x.getDate()).padStart(2, "0");
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${x.getFullYear()}`;
}

// Ordered by effective date (backdated payments land correctly), then
// creation order. Running balance = amount still owed after each row.
export function buildStatementRows(entries: StatementEntry[]): { rows: StatementRow[]; closing: number; totalCharges: number; totalPaid: number } {
  const ordered = [...entries].sort(
    (a, b) =>
      new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime() ||
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
  let balance = 0;
  let totalCharges = 0;
  let totalPaid = 0;
  const rows: StatementRow[] = ordered.map((e) => {
    const isDebit = e.direction === "DEBIT";
    balance += isDebit ? e.amount : -e.amount;
    if (e.type.startsWith("CHARGE")) totalCharges += e.amount;
    if (e.type === "PAYMENT") totalPaid += e.amount;
    if (e.type === "REVERSAL") totalPaid -= e.amount;
    return {
      date: formatDateDMY(e.effectiveDate),
      details: describeStatementEntry(e),
      debit: isDebit ? e.amount : null,
      credit: isDebit ? null : e.amount,
      balance,
    };
  });
  return { rows, closing: balance, totalCharges, totalPaid };
}

export type StatementPdfData = {
  transactionRef: string;
  bookingRef: string | null;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  propertyLine: string;
  entries: StatementEntry[];
  generatedAt: Date;
};

export function generateStatementPdf(data: StatementPdfData): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  embedNotoSans(doc); // throws when fonts are unavailable — never helvetica
  const fontName = "NotoSans";

  const W = doc.internal.pageSize.getWidth();
  const margin = 12;
  let y = drawLetterhead(doc, fontName, { margin, top: 14 });

  doc.setFont(fontName, "bold");
  doc.setFontSize(20);
  doc.setTextColor(22, 40, 31);
  doc.text("STATEMENT OF ACCOUNT", margin, y);
  doc.setFontSize(8);
  doc.setFont(fontName, "normal");
  doc.setTextColor(107, 102, 86);
  const rightX = W - margin;
  doc.text(`ACCOUNT: ${data.transactionRef}${data.bookingRef ? ` · ${data.bookingRef}` : ""}`, rightX, y - 6, { align: "right" });
  doc.text(`GENERATED: ${formatDateDMY(data.generatedAt)}`, rightX, y - 1, { align: "right" });
  y += 10;

  doc.setFont(fontName, "bold");
  doc.setFontSize(7);
  doc.setTextColor(107, 102, 86);
  doc.text("CLIENT", margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(22, 40, 31);
  const nameLines = doc.splitTextToSize(formatDisplayName(data.clientName), W - margin * 2);
  doc.text(nameLines, margin, y);
  y += 6 + (nameLines.length - 1) * 4;
  doc.setFont(fontName, "normal");
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  for (const contact of [data.clientPhone, data.clientEmail, data.propertyLine].filter(Boolean) as string[]) {
    const lines = doc.splitTextToSize(contact, W - margin * 2);
    doc.text(lines, margin, y);
    y += 3.5 * lines.length;
  }
  y += 4;

  const { rows, closing, totalCharges, totalPaid } = buildStatementRows(data.entries);
  const colW = [(W - margin * 2) * 0.16, (W - margin * 2) * 0.42, (W - margin * 2) * 0.14, (W - margin * 2) * 0.14, (W - margin * 2) * 0.14];
  const tableX = margin;
  const colX = [tableX + 2];
  for (let i = 1; i < colW.length; i++) colX.push(colX[i - 1] + colW[i - 1]);

  const header = () => {
    doc.setFillColor(22, 40, 31);
    doc.rect(tableX, y, W - margin * 2, 7, "F");
    doc.setTextColor(212, 179, 104);
    doc.setFont(fontName, "bold");
    doc.setFontSize(7);
    const headers = ["Date", "Details", "Debit (₦)", "Credit (₦)", "Balance (₦)"];
    for (let i = 0; i < headers.length; i++) {
      const right = i >= 2;
      doc.text(headers[i], right ? colX[i] + colW[i] - 2 : colX[i], y + 4.5, { align: right ? "right" : "left" });
    }
    y += 7;
  };
  const needPage = (h: number) => {
    if (y + h > 280) {
      doc.addPage();
      y = 14;
      header();
    }
  };

  header();
  doc.setFont(fontName, "normal");
  doc.setFontSize(7);
  rows.forEach((r, i) => {
    needPage(7);
    if (i % 2 === 1) {
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
    doc.setTextColor(22, 40, 31);
    doc.text(r.date, colX[0], y + 4.5);
    const detailLines = doc.splitTextToSize(r.details, colW[1] - 4);
    doc.text(detailLines.slice(0, 1), colX[1], y + 4.5);
    doc.text(r.debit != null ? formatNaira(r.debit) : "-", colX[2] + colW[2] - 2, y + 4.5, { align: "right" });
    doc.text(r.credit != null ? formatNaira(r.credit) : "-", colX[3] + colW[3] - 2, y + 4.5, { align: "right" });
    doc.text(formatNaira(r.balance), colX[4] + colW[4] - 2, y + 4.5, { align: "right" });
    y += 7;
  });

  needPage(14);
  doc.setFillColor(22, 40, 31);
  doc.rect(tableX, y, W - margin * 2, 14, "F");
  doc.setTextColor(212, 179, 104);
  doc.setFont(fontName, "bold");
  doc.text("Total charges", tableX + 2, y + 4.5);
  doc.text(formatNaira(totalCharges), colX[2] + colW[2] - 2, y + 4.5, { align: "right" });
  doc.text("Total paid", tableX + 2, y + 11);
  doc.text(formatNaira(totalPaid), colX[3] + colW[3] - 2, y + 11, { align: "right" });
  y += 14;
  doc.setFontSize(9);
  doc.setTextColor(22, 40, 31);
  doc.text(`Closing balance: ${closing <= 0 ? (closing < 0 ? `Credit ${formatNaira(-closing)}` : formatNaira(0)) : formatNaira(closing)}`, margin, y + 6);

  const out = doc.output("arraybuffer");
  return Buffer.from(out);
}
