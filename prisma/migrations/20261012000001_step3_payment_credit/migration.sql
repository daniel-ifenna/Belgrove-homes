ALTER TABLE "Payment" ADD COLUMN     "creditAmount" INTEGER,
ADD COLUMN     "isCredit" BOOLEAN NOT NULL DEFAULT false;

