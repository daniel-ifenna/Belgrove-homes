-- Phase 1 security/data fixes.
-- Captures schema.prisma changes that were never migrated (migrate dev cannot
-- run here: the database has pre-existing drift from db-push-era columns, and
-- a reset would destroy data). Only statements for objects missing from the
-- live database are included; already-applied drift (Payment workflow columns,
-- Receipt.paymentId unique index) is intentionally excluded.
-- Precondition verified 2026-09-28: no Receipt row has paymentId NULL
-- (manual receipt BEL-2026-91329 was deleted), so SET NOT NULL is safe.

-- Test-data flags (metrics/queues/lists exclude isTest rows)
ALTER TABLE "InspectionBooking" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Transaction" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;

-- Tokenized client receipt access (/r/{accessToken})
ALTER TABLE "Receipt" ADD COLUMN "accessToken" TEXT;
ALTER TABLE "Receipt" ADD COLUMN "accessTokenRevokedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Receipt_accessToken_key" ON "Receipt"("accessToken");

-- Payment idempotency keys (replaces the 60-second time-window dedupe)
ALTER TABLE "Payment" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- Receipts must belong to a payment (manual path removed)
ALTER TABLE "Receipt" ALTER COLUMN "paymentId" SET NOT NULL;

-- New receipt source for confirm-created receipts
ALTER TYPE "ReceiptSource" ADD VALUE 'PAYMENT_CONFIRMATION';
ALTER TABLE "Receipt" ALTER COLUMN "source" SET DEFAULT 'PAYMENT_CONFIRMATION';
