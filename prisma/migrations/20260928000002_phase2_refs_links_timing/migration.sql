-- Phase 2 refs/links/timing section: transaction manual reason,
-- booking inspection timestamp.
-- NOTE: Payment.paymentReference loses its @default(cuid()) in schema.prisma
-- (generator-required from here on); no column change, so no DDL here. Run
-- scripts/backfill-payment-refs.ts to replace existing cuid values with PAY-.

ALTER TABLE "Transaction" ADD COLUMN "manualReason" TEXT;
ALTER TABLE "InspectionBooking" ADD COLUMN "inspectedAt" TIMESTAMP(3);
