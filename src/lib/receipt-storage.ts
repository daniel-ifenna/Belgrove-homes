import fs from "node:fs";
import path from "node:path";

// Private receipt PDF storage. Never under public/ — PDFs are served only
// through the admin PDF route (session) or the token route (/r/{token}).
export const RECEIPT_STORAGE_DIR = "storage/receipts";

export function receiptPdfPath(ref: string): string {
  return `${RECEIPT_STORAGE_DIR}/${ref}.pdf`;
}

export function receiptPdfAbsolute(pdfPath: string): string {
  return path.join(process.cwd(), pdfPath);
}

// Writes a receipt PDF, creating the storage directory as needed.
export async function writeReceiptPdf(pdfPath: string, data: Buffer): Promise<void> {
  const abs = receiptPdfAbsolute(pdfPath);
  await fs.promises.mkdir(path.dirname(abs), { recursive: true });
  await fs.promises.writeFile(abs, data);
}
