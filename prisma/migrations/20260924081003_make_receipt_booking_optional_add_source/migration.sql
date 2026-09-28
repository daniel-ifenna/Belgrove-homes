-- CreateEnum
CREATE TYPE "ReceiptSource" AS ENUM ('BOOKING_FLOW', 'ADMIN_MANUAL');

-- AlterEnum
ALTER TYPE "ReceiptStatus" ADD VALUE 'draft';

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "source" "ReceiptSource" NOT NULL DEFAULT 'BOOKING_FLOW',
ALTER COLUMN "bookingId" DROP NOT NULL;
