-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'reviewer';
ALTER TYPE "Role" ADD VALUE 'approver';

-- AlterTable
ALTER TABLE "InspectionBooking" ADD COLUMN     "agentConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "agentConfirmedById" TEXT,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "possibleDuplicateOfId" TEXT,
ADD COLUMN     "visitorAgentRaw" TEXT;

-- CreateTable
CREATE TABLE "InternalNote" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InternalNote_bookingId_createdAt_idx" ON "InternalNote"("bookingId", "createdAt");

-- CreateIndex
CREATE INDEX "InspectionBooking_lockedAt_idx" ON "InspectionBooking"("lockedAt");

-- AddForeignKey
ALTER TABLE "InspectionBooking" ADD CONSTRAINT "InspectionBooking_possibleDuplicateOfId_fkey" FOREIGN KEY ("possibleDuplicateOfId") REFERENCES "InspectionBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionBooking" ADD CONSTRAINT "InspectionBooking_agentConfirmedById_fkey" FOREIGN KEY ("agentConfirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "InspectionBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
