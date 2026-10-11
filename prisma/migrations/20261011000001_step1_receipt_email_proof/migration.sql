-- Step 1 (additive): minimal permanent email proof on Receipt.
-- Failures are never recorded — not-emailed is simply sentAt IS NULL.
ALTER TABLE "Receipt" ADD COLUMN "resendEmailId" TEXT;

-- Backfill from the last successful Resend send per receipt, so existing
-- emailed receipts keep a deep link into the Resend dashboard.
UPDATE "Receipt" r SET "resendEmailId" = s."providerMessageId"
FROM (
  SELECT DISTINCT ON ("relatedId") "relatedId", "providerMessageId"
  FROM "EmailOutbox"
  WHERE "type" = 'receipt'
    AND "status" = 'SENT'
    AND "provider" = 'resend'
    AND "providerMessageId" IS NOT NULL
  ORDER BY "relatedId", "createdAt" DESC
) s
WHERE r.id = s."relatedId" AND r."resendEmailId" IS NULL;
