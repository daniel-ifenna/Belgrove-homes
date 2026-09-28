import { logServerError } from "./paymentConfirmation";

// Post-commit receipt side effects. These run AFTER the confirmation
// transaction commits — PDF rendering, file I/O, and SMTP can each take
// seconds, and none of them may ever roll back a CONFIRMED payment.
// Every failure is recorded on the receipt row (pdfStatus/emailStatus +
// lastError) and logged; helpers never throw for delivery failures.

export interface ReceiptStatusStore {
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
}

export interface DeliveryDb {
  receipt: ReceiptStatusStore;
}

function shortMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error ?? "unknown error");
  return msg.slice(0, 500);
}

export async function generateAndStoreReceiptPdf(opts: {
  db: DeliveryDb;
  receiptId: string;
  ref: string;
  pdfPath: string;
  // Injected so tests can simulate a >5s render and routes stay thin.
  render: () => Buffer | Promise<Buffer>;
  writeFile: (filePath: string, data: Buffer) => Promise<void>;
}): Promise<{ ok: boolean; error: string | null }> {
  let buffer: Buffer;
  try {
    buffer = await opts.render();
  } catch (error) {
    logServerError(`receipt ${opts.ref}: PDF render failed`, error);
    await markPdf(opts.db, opts.receiptId, "FAILED", shortMessage(error));
    return { ok: false, error: shortMessage(error) };
  }
  try {
    await opts.writeFile(opts.pdfPath, buffer);
  } catch (error) {
    logServerError(`receipt ${opts.ref}: PDF write failed (${opts.pdfPath})`, error);
    await markPdf(opts.db, opts.receiptId, "FAILED", shortMessage(error));
    return { ok: false, error: shortMessage(error) };
  }
  await markPdf(opts.db, opts.receiptId, "GENERATED", null);
  return { ok: true, error: null };
}

async function markPdf(
  db: DeliveryDb,
  receiptId: string,
  pdfStatus: "GENERATED" | "FAILED",
  lastError: string | null
): Promise<void> {
  try {
    await db.receipt.update({
      where: { id: receiptId },
      data: { pdfStatus, lastError },
    });
  } catch (error) {
    // The payment is already confirmed; a bookkeeping write failing must not
    // surface as a confirmation failure — log it loudly instead.
    logServerError(`receipt ${receiptId}: failed to persist pdfStatus=${pdfStatus}`, error);
  }
}

export async function deliverReceiptEmail(opts: {
  db: DeliveryDb;
  receiptId: string;
  ref: string;
  send: () => Promise<{ sent: boolean; error: string | null }>;
}): Promise<{ sent: boolean; error: string | null }> {
  let result: { sent: boolean; error: string | null };
  try {
    result = await opts.send();
  } catch (error) {
    logServerError(`receipt ${opts.ref}: email send threw`, error);
    result = { sent: false, error: shortMessage(error) };
  }
  try {
    await opts.db.receipt.update({
      where: { id: opts.receiptId },
      data: {
        emailStatus: result.sent ? "SENT" : "FAILED",
        sentAt: result.sent ? new Date() : undefined,
        lastError: result.sent ? null : result.error,
        // Keep the legacy status column in sync for existing UIs.
        status: result.sent ? "sent" : "failed",
        error: result.sent ? null : result.error,
      },
    });
  } catch (error) {
    logServerError(`receipt ${opts.ref}: failed to persist emailStatus`, error);
  }
  return result;
}
