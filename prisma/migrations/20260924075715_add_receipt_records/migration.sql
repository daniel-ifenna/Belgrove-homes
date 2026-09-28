-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('pending', 'generated', 'sent', 'failed');

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "property" TEXT NOT NULL,
    "estate" TEXT,
    "plotCode" TEXT,
    "unitType" TEXT,
    "sqm" INTEGER,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "amountBeforeDiscount" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "finalAmount" INTEGER NOT NULL,
    "amountInWords" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "paymentDescription" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "paymentHistory" JSONB,
    "agentId" TEXT,
    "agentName" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "recipientEmail" TEXT NOT NULL,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'pending',
    "receiptUrl" TEXT NOT NULL,
    "qrTargetUrl" TEXT NOT NULL,
    "pdfPath" TEXT,
    "createdById" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptSendAttempt" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,

    CONSTRAINT "ReceiptSendAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_ref_key" ON "Receipt"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_bookingId_key" ON "Receipt"("bookingId");

-- CreateIndex
CREATE INDEX "Receipt_status_idx" ON "Receipt"("status");

-- CreateIndex
CREATE INDEX "Receipt_customerEmail_idx" ON "Receipt"("customerEmail");

-- CreateIndex
CREATE INDEX "Receipt_estate_idx" ON "Receipt"("estate");

-- CreateIndex
CREATE INDEX "Receipt_issuedAt_idx" ON "Receipt"("issuedAt");

-- CreateIndex
CREATE INDEX "Receipt_bookingId_idx" ON "Receipt"("bookingId");

-- CreateIndex
CREATE INDEX "ReceiptSendAttempt_receiptId_attemptedAt_idx" ON "ReceiptSendAttempt"("receiptId", "attemptedAt");

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "InspectionBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptSendAttempt" ADD CONSTRAINT "ReceiptSendAttempt_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptSendAttempt" ADD CONSTRAINT "ReceiptSendAttempt_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
