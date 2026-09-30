-- Proof of sending on EmailOutbox. Both columns are nullable so every
-- existing row is untouched; they are written only when a send succeeds
-- (provider = 'resend' | 'smtp', providerMessageId = the provider's message
-- id for tracing the delivery). AUTHORED ONLY — not yet applied to any
-- database; apply with `prisma migrate deploy` before deploying the code
-- that writes these columns.
ALTER TABLE "EmailOutbox" ADD COLUMN "provider" TEXT;
ALTER TABLE "EmailOutbox" ADD COLUMN "providerMessageId" TEXT;
