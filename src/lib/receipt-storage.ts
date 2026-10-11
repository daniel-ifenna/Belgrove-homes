import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Private receipt PDF storage helpers — LOCAL DEV AND ONE-OFF SCRIPTS ONLY
// (scripts/regenerate-receipts.ts, scripts/migrate-receipt-storage.ts).
//
// Server request paths (confirm, resend, outbox sender, PDF downloads)
// NEVER touch the filesystem: they render the PDF in memory from the
// receipt snapshot on every send/download. The receipt row is the durable
// truth. This module survives only so dev scripts keep working; nothing in
// src/app or the email pipeline may import writeReceiptPdf.
export function getReceiptStorageDir(): string {
  const override = process.env.RECEIPT_STORAGE_DIR?.trim();
  if (override) return override;
  if (process.env.VERCEL === "1" || process.env.NODE_ENV === "production") {
    return path.join(os.tmpdir(), "belgrove-receipts");
  }
  return "storage/receipts";
}

export const RECEIPT_STORAGE_DIR = getReceiptStorageDir();

export function receiptPdfPath(ref: string): string {
  return `${getReceiptStorageDir()}/${ref}.pdf`;
}

export function receiptPdfAbsolute(pdfPath: string): string {
  // Already absolute (new production rows): use as-is.
  if (path.isAbsolute(pdfPath)) return pdfPath;
  const base = getReceiptStorageDir();
  // Legacy rows store "storage/receipts/{ref}.pdf" (dev cwd-relative). On
  // serverless the cache moved to /tmp — map the filename across so old
  // rows resolve to the writable cache instead of /var/task/storage/....
  if (path.isAbsolute(base)) return path.join(base, path.basename(pdfPath));
  // Resolved against the runtime working directory WITHOUT calling
  // process.cwd(): Turbopack statically traces that call and bundles the
  // whole project (including public/) into server functions, risking
  // deployment size-limit failures.
  return path.resolve(pdfPath);
}

// Writes a receipt PDF, creating the storage directory as needed.
export async function writeReceiptPdf(pdfPath: string, data: Buffer): Promise<void> {
  const abs = receiptPdfAbsolute(pdfPath);
  await fs.promises.mkdir(path.dirname(abs), { recursive: true });
  await fs.promises.writeFile(abs, data);
}
