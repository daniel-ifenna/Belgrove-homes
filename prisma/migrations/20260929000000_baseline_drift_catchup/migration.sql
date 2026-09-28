-- Baseline catch-up: objects present in the live database that no
-- migration file ever created (pre-migration db-push era + two
-- over-eager column defaults in hand-written migrations).
-- Generated verbatim by: prisma migrate diff --from-migrations
-- ./prisma/migrations --to-schema ./prisma/schema.prisma
-- Marked applied on dev WITHOUT running (objects already exist);
-- executes normally on fresh databases.


-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PENDING_VERIFICATION', 'CONFIRMED', 'FAILED', 'CANCELLED', 'WAIVED');

-- AlterTable
ALTER TABLE "Customer" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "EmailOutbox" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "bankReference" TEXT,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedById" TEXT,
ADD COLUMN     "paymentReference" TEXT NOT NULL,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "verificationNotes" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_paymentReference_key" ON "Payment"("paymentReference");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_paymentId_key" ON "Receipt"("paymentId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

