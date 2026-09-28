-- Phase 2 customer section: canonical Customer records linked from
-- bookings and transactions (nullable during migration; backfilled by
-- scripts/backfill-customers.ts).

CREATE TABLE "Customer" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "secondaryPhones" TEXT[] NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

ALTER TABLE "InspectionBooking" ADD COLUMN "customerId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "customerId" TEXT;

ALTER TABLE "InspectionBooking" ADD CONSTRAINT "InspectionBooking_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
