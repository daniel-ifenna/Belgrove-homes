ALTER TABLE "Payment" ADD COLUMN     "correctsPaymentId" TEXT,
ADD COLUMN     "verificationNote" TEXT;

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "replacedByReceiptId" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "contractDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Statement" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tokenRevokedAt" TIMESTAMP(3),
    "pdfData" BYTEA NOT NULL,
    "closingBalance" INTEGER NOT NULL,
    "ledgerHash" TEXT NOT NULL,
    "asAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailSentAt" TIMESTAMP(3),
    "emailRecipient" TEXT,
    "resendEmailId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Statement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Statement_number_key" ON "Statement"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Statement_token_key" ON "Statement"("token");

-- CreateIndex
CREATE INDEX "Statement_transactionId_idx" ON "Statement"("transactionId");

-- CreateIndex
CREATE INDEX "Statement_transactionId_ledgerHash_idx" ON "Statement"("transactionId", "ledgerHash");

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_replacedByReceiptId_fkey" FOREIGN KEY ("replacedByReceiptId") REFERENCES "Receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_correctsPaymentId_fkey" FOREIGN KEY ("correctsPaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

