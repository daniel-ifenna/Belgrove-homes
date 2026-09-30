import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Private receipt PDF storage. Never under public/ — PDFs are served only
// through the admin PDF route (session) or the token route (/r/{token}).
//
// Serverless note: Vercel functions have a read-only filesystem except
// os.tmpdir() (/tmp). Writing to "storage/receipts" resolves to
// /var/task/storage/receipts and crashes with
// ENOENT: no such file or directory, mkdir '/var/task/storage/receipts'.
// So on Vercel / production the cache lives under /tmp (ephemeral), and
// every reader treats the file as a best-effort cache — the durable truth
// is the receipt row, and PDFs are regenerated from the snapshot when the
// cached file is missing. Override with RECEIPT_STORAGE_DIR when needed.
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
