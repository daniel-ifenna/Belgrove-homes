-- Step 1 (cleanup): drop local email delivery tracking. Resend's dashboard
-- is the delivery log; each receipt keeps only resendEmailId + sentAt +
-- recipientEmail. Send history was exported to CSV before this migration
-- (receipt-send-attempts-20261011.csv, receipt-outbox-20261011.csv).
-- Existing sent receipts keep working: no ref, URL, token or PDF changes.

-- Drop dependent objects first.
DROP TABLE IF EXISTS "ReceiptSendAttempt";
DROP TABLE IF EXISTS "EmailOutbox";

-- Receipt: drop email-tracking columns (keep pdfStatus for PDF build state,
-- sentAt/recipientEmail/resendEmailId as the minimal proof).
ALTER TABLE "Receipt" DROP COLUMN IF EXISTS "status";
ALTER TABLE "Receipt" DROP COLUMN IF EXISTS "emailStatus";
ALTER TABLE "Receipt" DROP COLUMN IF EXISTS "lastError";
ALTER TABLE "Receipt" DROP COLUMN IF EXISTS "error";

-- Unused enum (no column references it anymore).
DROP TYPE IF EXISTS "ReceiptStatus";
DROP TYPE IF EXISTS "EmailOutboxStatus";
