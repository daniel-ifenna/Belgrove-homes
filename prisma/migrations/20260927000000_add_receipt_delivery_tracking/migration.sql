-- Add post-commit delivery tracking to Receipt, so a PDF or email failure
-- never rolls back an already-confirmed payment.
ALTER TABLE "Receipt" ADD COLUMN "pdfStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Receipt" ADD COLUMN "emailStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Receipt" ADD COLUMN "lastError" TEXT;

-- Backfill from existing state: a stored pdfPath means a PDF was written;
-- the legacy status carries the email outcome; legacy error text is kept.
UPDATE "Receipt" SET "pdfStatus" = 'GENERATED' WHERE "pdfPath" IS NOT NULL;
UPDATE "Receipt" SET "emailStatus" = CASE WHEN "status" = 'sent' THEN 'SENT' WHEN "status" = 'failed' THEN 'FAILED' ELSE 'PENDING' END;
UPDATE "Receipt" SET "lastError" = "error" WHERE "error" IS NOT NULL;
