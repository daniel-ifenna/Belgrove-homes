-- Additive, zero-risk to existing rows: receipt PDF bytes stored on the row
-- (rendered once at confirmation, reused for sends/downloads), outbox
-- priority so receipts send before bulk mail, and first-send timestamp for
-- queue-wait/send-duration display.
ALTER TABLE "Receipt" ADD COLUMN "pdfData" BYTEA;
ALTER TABLE "EmailOutbox" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmailOutbox" ADD COLUMN "startedAt" TIMESTAMP(3);
-- Backfill: existing receipt/confirmation rows jump the queue like new ones.
UPDATE "EmailOutbox" SET "priority" = 10 WHERE "type" IN ('receipt', 'transaction_confirmation');
